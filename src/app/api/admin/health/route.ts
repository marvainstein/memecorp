import { requireAdmin } from "@/lib/auth";
import { config } from "@/lib/config";
import { query } from "@/lib/db";
import { json } from "@/lib/http";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const describe = (err: unknown) => {
  const e = err as { name?: string; message?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return { name: e.name ?? "Error", code: e.Code, status: e.$metadata?.httpStatusCode, message: String(e.message ?? err).slice(0, 300) };
};

/** Deployment check: which storage/database settings the server sees (never the secrets) and whether they work. */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const s = config.storage;
  const result: Record<string, unknown> = {
    runtime: { vercel: Boolean(process.env.VERCEL), region: process.env.VERCEL_REGION ?? null, scheduler: config.import.scheduler },
    storage: {
      driver: s.driver,
      bucket: s.bucket || null,
      endpoint: s.endpoint ?? null,
      region: s.region,
      forcePathStyle: s.forcePathStyle,
      accessKeyId: s.accessKeyId ? `${s.accessKeyId.slice(0, 4)}… (${s.accessKeyId.length} caracteres)` : null,
      secretAccessKey: s.secretAccessKey ? `(${s.secretAccessKey.length} caracteres)` : null,
      publicUrl: s.publicUrl || null,
    },
  };
  try {
    const [row] = await query<{ n: number; key: string | null }>(
      "SELECT count(*)::int AS n, (array_agg(thumb_key) FILTER (WHERE thumb_key IS NOT NULL))[1] AS key FROM memes WHERE status = 'active'",
    );
    result.database = { ok: true, activeMemes: row.n };
    if (row.key) {
      try {
        const body = await storage().get(row.key);
        result.storageCheck = body ? { ok: true, key: row.key, bytes: body.byteLength } : { ok: false, key: row.key, error: "El archivo no está en el bucket" };
      } catch (err) {
        result.storageCheck = { ok: false, key: row.key, error: describe(err) };
      }
    }
  } catch (err) {
    result.database = { ok: false, error: describe(err) };
  }
  return json(result);
}
