import fs from "node:fs";
import path from "node:path";
import { config } from "../config";
import { migrate } from "./schema";

export type Row = Record<string, unknown>;

/** Minimal driver-agnostic interface: node-postgres in production, PGlite in development. */
export interface Db {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  /** Runs `fn` on a single connection inside BEGIN/COMMIT (ROLLBACK on error). */
  transaction<T>(fn: (tx: Pick<Db, "query">) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: "postgres" | "pglite";
}

/** Looser trigram thresholds than the defaults (0.6 / 0.3) so typos like "reunon" still match. */
const SESSION_SETTINGS = "SET pg_trgm.word_similarity_threshold = 0.45; SET pg_trgm.similarity_threshold = 0.3;";

const globalForDb = globalThis as unknown as { __memedeskDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__memedeskDb) {
    globalForDb.__memedeskDb = connect().catch((err) => {
      globalForDb.__memedeskDb = undefined;
      throw err;
    });
  }
  return globalForDb.__memedeskDb;
}

export async function query<T = Row>(text: string, params?: unknown[]): Promise<T[]> {
  const db = await getDb();
  return db.query<T>(text, params);
}

export async function closeDb(): Promise<void> {
  const pending = globalForDb.__memedeskDb;
  globalForDb.__memedeskDb = undefined;
  if (pending) await (await pending).close();
}

async function connect(): Promise<Db> {
  const db = config.databaseUrl ? await connectPostgres(config.databaseUrl) : await connectPglite();
  await migrate(db);
  return db;
}

async function connectPostgres(connectionString: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, max: Number(process.env.DATABASE_POOL_SIZE || 10) });
  pool.on("connect", (client) => {
    client.query(SESSION_SETTINGS).catch(() => {});
  });
  return {
    kind: "postgres",
    query: async <T>(text: string, params?: unknown[]) => (await pool.query(text, params as unknown[])).rows as T[],
    exec: async (sql) => {
      await pool.query(sql);
    },
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({ query: async <T>(text: string, params?: unknown[]) => (await client.query(text, params as unknown[])).rows as T[] });
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function connectPglite(): Promise<Db> {
  const [{ PGlite }, { pg_trgm }, { unaccent }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("@electric-sql/pglite/contrib/pg_trgm"),
    import("@electric-sql/pglite/contrib/unaccent"),
  ]);
  const dir = path.join(config.dataDir, "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const pg = await PGlite.create(dir, { extensions: { pg_trgm, unaccent } });
  await pg.exec("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  await pg.exec(SESSION_SETTINGS);
  return {
    kind: "pglite",
    query: async <T>(text: string, params?: unknown[]) => (await pg.query<T>(text, params)).rows,
    exec: async (sql) => {
      await pg.exec(sql);
    },
    transaction: (fn) => pg.transaction((tx) => fn({ query: async <T>(text: string, params?: unknown[]) => (await tx.query<T>(text, params)).rows })),
    close: () => pg.close(),
  };
}
