/**
 * Copies the local catalog (embedded PGlite in ./data/pglite + images in ./data/uploads) to the
 * production services: a PostgreSQL database (DATABASE_URL, e.g. Neon) and an S3-compatible bucket
 * (S3_*, e.g. Cloudflare R2 or Backblaze B2).
 *
 *   npm run migrate:cloud               # reads .env.cloud.local
 *   npm run migrate:cloud -- --replace  # overwrite a target database that already has memes
 *   npm run migrate:cloud -- --skip-images
 *
 * Stop `npm run dev` first (only one process can open PGlite). Images already in the bucket are
 * skipped, so the script can be re-run after an interruption.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { config } from "@/lib/config";
import { mimeFromKey, storage } from "@/lib/storage";

/** Parents before children (foreign keys). */
const TABLES = ["memes", "reports", "search_log", "synonym_groups", "import_sources", "import_runs", "import_seen"];
/** Filled in by the memes trigger on insert. */
const DERIVED = new Set(["search_doc", "search_text"]);
const BATCH = 200;
const UPLOAD_CONCURRENCY = 8;

const sourceDir = path.resolve(process.env.SOURCE_DATA_DIR || "data");

async function openSource() {
  const [{ PGlite }, { pg_trgm }, { unaccent }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("@electric-sql/pglite/contrib/pg_trgm"),
    import("@electric-sql/pglite/contrib/unaccent"),
  ]);
  return PGlite.create(path.join(sourceDir, "pglite"), { extensions: { pg_trgm, unaccent } });
}

async function copyImages(keys: string[]) {
  const bucket = storage();
  let done = 0;
  let uploaded = 0;
  const missing: string[] = [];
  const queue = [...keys];
  await Promise.all(
    Array.from({ length: UPLOAD_CONCURRENCY }, async () => {
      for (let key = queue.shift(); key; key = queue.shift()) {
        if (!(await bucket.exists(key))) {
          const body = await fs.readFile(path.join(sourceDir, "uploads", key)).catch(() => null);
          if (body) {
            await bucket.put(key, body, mimeFromKey(key));
            uploaded++;
          } else missing.push(key);
        }
        if (++done % 100 === 0 || done === keys.length) console.log(`  imágenes: ${done}/${keys.length} (${uploaded} subidas)`);
      }
    }),
  );
  if (missing.length) console.warn(`  ⚠ ${missing.length} archivos no están en ${sourceDir}/uploads (p. ej. ${missing[0]})`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL (la base de destino, p. ej. Neon).");
  if (!args.includes("--skip-images") && config.storage.driver !== "s3") {
    throw new Error("Faltan los datos del bucket (S3_BUCKET y demás S3_*). Usá --skip-images para copiar solo la base.");
  }

  const source = await openSource();
  const target = await getDb(); // connects to DATABASE_URL and creates the schema
  try {
    const [{ n }] = await target.query<{ n: number }>("SELECT count(*)::int AS n FROM memes");
    if (n > 0 && !args.includes("--replace")) {
      throw new Error(`La base de destino ya tiene ${n} memes. Usá --replace para reemplazarla con la local.`);
    }

    if (!args.includes("--skip-images")) {
      const rows = (await source.query<{ storage_key: string | null; thumb_key: string | null }>("SELECT storage_key, thumb_key FROM memes")).rows;
      const keys = [...new Set(rows.flatMap((r) => [r.storage_key, r.thumb_key]).filter((k): k is string => !!k))];
      console.log(`Subiendo ${keys.length} imágenes al bucket…`);
      await copyImages(keys);
    }

    console.log("Copiando la base de datos…");
    await target.exec(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
    for (const table of TABLES) {
      const targetCols = new Set(
        (await target.query<{ column_name: string }>(
          "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1",
          [table],
        )).map((r) => r.column_name),
      );
      const rows = (await source.query<Record<string, unknown>>(`SELECT * FROM ${table}`)).rows;
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]).filter((c) => targetCols.has(c) && !DERIVED.has(c));
      const list = cols.map((c) => `"${c}"`).join(", ");
      // json_populate_recordset converts each JSON value to the column's type (arrays, jsonb, bit, timestamptz).
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH).map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
        await target.query(`INSERT INTO ${table} (${list}) SELECT ${list} FROM json_populate_recordset(NULL::${table}, $1::json)`, [JSON.stringify(batch)]);
      }
      console.log(`  ${table}: ${rows.length}`);
    }
    await target.query("SELECT setval(pg_get_serial_sequence('synonym_groups', 'id'), GREATEST((SELECT max(id) FROM synonym_groups), 1))");
    // Nobody is importing on the target yet; clear locks copied from a running dev server.
    await target.query("UPDATE import_sources SET running_since = NULL");
    await target.query("UPDATE import_runs SET status = 'failed', finished_at = now(), message = 'Interrumpida (migración)' WHERE status = 'running'");

    const [{ active }] = await target.query<{ active: number }>("SELECT count(*)::int AS active FROM memes WHERE status = 'active'");
    console.log(`Listo: ${active} memes activos en la base de destino.`);
  } finally {
    await source.close();
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
