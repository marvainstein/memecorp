import type { Db } from "./index";
import { ruleCategories } from "../importers/autotag";
import { DEFAULT_SOURCES } from "../importers/defaults";
import { taxonomyKeywords } from "../memes/taxonomy";
import { FRANCHISES } from "../memes/franchises";
import { DEFAULT_SYNONYM_GROUPS } from "../search/synonyms";

/**
 * Ordered, append-only migrations. Never edit a shipped migration; add a new one.
 * Every statement must run on PostgreSQL 14+ and on PGlite (PostgreSQL 17 in WASM).
 */
const sqlText = (s: string) => `'${s.replace(/'/g, "''")}'`;
const sqlTextArray = (list: string[]) => `ARRAY[${list.map(sqlText).join(", ")}]::text[]`;

/**
 * Gives every meme without a topic category the ones the keyword rules (src/lib/importers/autotag.ts)
 * find in its text. Only adds; memes that already have a topic category are left as they are.
 */
async function addRuleCategories(db: Db) {
  const rows = await db.query<{ id: string; categories: string[]; text: string }>(
    `SELECT id, categories, concat_ws(' ', title, description, alt_text, ocr_text, array_to_string(tags, ' ')) AS text FROM memes`,
  );
  const updates = rows.flatMap((r) => {
    const added = ruleCategories(r.text, r.categories).filter((c) => !r.categories.includes(c));
    if (!added.length) return [];
    const categories = [...added, ...r.categories].slice(0, 4);
    return [{ id: r.id, categories, keywords: taxonomyKeywords(categories) }];
  });
  if (!updates.length) return;
  await db.query(
    `UPDATE memes m SET categories = u.categories, keywords = u.keywords, updated_at = now()
     FROM jsonb_to_recordset($1::jsonb) AS u(id text, categories text[], keywords text) WHERE m.id = u.id`,
    [JSON.stringify(updates)],
  );
}

/** `sql` changes the schema; `run` changes data with code (for rules that live in TypeScript). */
const MIGRATIONS: { version: number; name: string; sql?: string; run?: (db: Db) => Promise<void> }[] = [
  {
    version: 1,
    name: "initial schema",
    sql: /* sql */ `
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Immutable wrappers so normalization can be used in indexes and triggers.
CREATE OR REPLACE FUNCTION md_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT unaccent('unaccent'::regdictionary, $1) $$;

-- Must match normalize() in src/lib/text.ts.
CREATE OR REPLACE FUNCTION md_norm(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT btrim(regexp_replace(lower(md_unaccent(coalesce($1, ''))), '[^a-z0-9]+', ' ', 'g')) $$;

CREATE TABLE IF NOT EXISTS memes (
  id             text PRIMARY KEY,
  slug           text NOT NULL,
  title          text NOT NULL,
  description    text NOT NULL DEFAULT '',
  alt_text       text NOT NULL DEFAULT '',
  ocr_text       text NOT NULL DEFAULT '',
  source_url     text,
  source_name    text,
  credit         text,
  license        text NOT NULL DEFAULT 'fair-use',
  origin         text NOT NULL DEFAULT 'admin' CHECK (origin IN ('admin', 'import', 'seed')),
  storage_key    text,
  thumb_key      text,
  mime           text NOT NULL,
  format         text NOT NULL,
  width          integer NOT NULL,
  height         integer NOT NULL,
  bytes          integer NOT NULL,
  sha256         text NOT NULL UNIQUE,
  phash          bit(256),
  dominant_color text,
  languages      text[] NOT NULL DEFAULT '{}',
  tags           text[] NOT NULL DEFAULT '{}',
  synonyms       text[] NOT NULL DEFAULT '{}',
  categories     text[] NOT NULL DEFAULT '{}',
  emotions       text[] NOT NULL DEFAULT '{}',
  keywords       text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'pending', 'hidden', 'removed', 'rejected')),
  status_reason  text,
  submitter_note text,
  download_count integer NOT NULL DEFAULT 0,
  share_count    integer NOT NULL DEFAULT 0,
  view_count     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  search_doc     tsvector,
  search_text    text NOT NULL DEFAULT ''
);

CREATE OR REPLACE FUNCTION memes_search_refresh() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  labels text := array_to_string(NEW.tags || NEW.synonyms, ' ') || ' ' || NEW.keywords;
  body   text := NEW.description || ' ' || NEW.alt_text || ' ' || NEW.ocr_text;
  everything text := NEW.title || ' ' || labels || ' ' || body;
BEGIN
  NEW.search_doc :=
       setweight(to_tsvector('simple',  md_norm(NEW.title)), 'A')
    || setweight(to_tsvector('simple',  md_norm(labels)), 'B')
    || setweight(to_tsvector('simple',  md_norm(body)), 'C')
    || setweight(to_tsvector('english', md_norm(everything)), 'D')
    || setweight(to_tsvector('spanish', md_norm(everything)), 'D');
  NEW.search_text := left(md_norm(NEW.title || ' ' || labels || ' ' || NEW.ocr_text), 4000);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS memes_search_refresh ON memes;
CREATE TRIGGER memes_search_refresh
  BEFORE INSERT OR UPDATE OF title, description, alt_text, ocr_text, tags, synonyms, keywords
  ON memes FOR EACH ROW EXECUTE FUNCTION memes_search_refresh();

CREATE INDEX IF NOT EXISTS memes_search_doc_idx   ON memes USING gin (search_doc);
CREATE INDEX IF NOT EXISTS memes_search_trgm_idx  ON memes USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS memes_tags_idx         ON memes USING gin (tags);
CREATE INDEX IF NOT EXISTS memes_emotions_idx     ON memes USING gin (emotions);
CREATE INDEX IF NOT EXISTS memes_categories_idx   ON memes USING gin (categories);
CREATE INDEX IF NOT EXISTS memes_status_new_idx   ON memes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS memes_status_pop_idx   ON memes (status, download_count DESC);
CREATE INDEX IF NOT EXISTS memes_source_url_idx   ON memes (source_url);

CREATE TABLE IF NOT EXISTS reports (
  id               text PRIMARY KEY,
  meme_id          text REFERENCES memes(id) ON DELETE SET NULL,
  target_url       text,
  reason           text NOT NULL
                   CHECK (reason IN ('copyright', 'privacy', 'offensive', 'broken', 'spam', 'other')),
  details          text NOT NULL DEFAULT '',
  reporter_name    text,
  reporter_email   text,
  is_rights_holder boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
  resolution       text,
  ip_hash          text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_meme_idx   ON reports (meme_id);

CREATE TABLE IF NOT EXISTS search_log (
  query        text PRIMARY KEY,
  display      text NOT NULL,
  count        integer NOT NULL DEFAULT 1,
  last_results integer NOT NULL DEFAULT 0,
  last_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_log_trgm_idx ON search_log USING gin (query gin_trgm_ops);

CREATE TABLE IF NOT EXISTS synonym_groups (
  id         serial PRIMARY KEY,
  terms      text[] NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`,
  },
  {
    version: 2,
    name: "automated import sources",
    sql: /* sql */ `
CREATE TABLE IF NOT EXISTS import_sources (
  id                   text PRIMARY KEY,
  adapter              text NOT NULL,
  name                 text NOT NULL,
  config               jsonb NOT NULL DEFAULT '{}',
  enabled              boolean NOT NULL DEFAULT true,
  interval_minutes     integer NOT NULL DEFAULT 360,
  cursor               jsonb,
  running_since        timestamptz,
  last_run_at          timestamptz,
  last_success_at      timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  paused_until         timestamptz,
  last_error           text,
  total_imported       integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_runs (
  id          text PRIMARY KEY,
  source_id   text NOT NULL REFERENCES import_sources(id) ON DELETE CASCADE,
  trigger     text NOT NULL DEFAULT 'schedule',
  status      text NOT NULL CHECK (status IN ('running', 'success', 'partial', 'failed', 'skipped')),
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  fetched     integer NOT NULL DEFAULT 0,
  created     integer NOT NULL DEFAULT 0,
  duplicates  integer NOT NULL DEFAULT 0,
  skipped     integer NOT NULL DEFAULT 0,
  failed      integer NOT NULL DEFAULT 0,
  message     text
);
CREATE INDEX IF NOT EXISTS import_runs_source_idx ON import_runs (source_id, started_at DESC);

-- Every item an adapter has already looked at, so it is never downloaded twice.
CREATE TABLE IF NOT EXISTS import_seen (
  source_id   text NOT NULL,
  external_id text NOT NULL,
  outcome     text NOT NULL,
  meme_id     text,
  seen_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, external_id)
);
`,
  },
  {
    version: 3,
    name: "workplace_shows",
    // Existing installs: add a synonym group per workplace show (fresh installs get them from the
    // defaults) and treat r/DunderMifflin as on-topic.
    sql: `
${FRANCHISES.map(
  (f) => `INSERT INTO synonym_groups (terms)
SELECT ${sqlTextArray(f.names)}
WHERE EXISTS (SELECT 1 FROM synonym_groups)
  AND NOT EXISTS (SELECT 1 FROM synonym_groups WHERE ${sqlText(f.names[0])} = ANY (terms));`,
).join("\n")}

UPDATE import_sources
SET config = jsonb_set(config, '{topical}', (config->'topical') || '["DunderMifflin"]'::jsonb)
WHERE id = 'reddit-work-humor' AND jsonb_typeof(config->'topical') = 'array'
  AND NOT (config->'topical') ? 'DunderMifflin';
`,
  },
  {
    version: 4,
    name: "drop_emotions",
    // Memes are organized by category only.
    sql: `ALTER TABLE memes DROP COLUMN IF EXISTS emotions;`,
  },
  {
    version: 5,
    name: "trigram_thresholds_per_database",
    // Connection poolers (Neon, Supabase) don't keep per-session SETs, so store the looser trigram
    // thresholds on the database too. Skipped silently where it isn't allowed (PGlite, limited roles).
    sql: `DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET pg_trgm.word_similarity_threshold = 0.45', current_database());
  EXECUTE format('ALTER DATABASE %I SET pg_trgm.similarity_threshold = 0.3', current_database());
EXCEPTION WHEN others THEN NULL;
END $$;`,
  },
  {
    version: 6,
    name: "keyword_topic_categories",
    // Memes imported before the keyword rules (src/lib/importers/autotag.ts) only had generic categories;
    // give them the topic categories their text points at. Only adds, and only to memes without a topic.
    run: addRuleCategories,
  },
  {
    version: 7,
    name: "keyword_topic_categories_es",
    // The keyword rules gained Spanish variants and plurals ("jefa", "cansado", "renunciar", "quincena"…);
    // run them again over the memes that still have no topic category.
    run: addRuleCategories,
  },
];

export async function migrate(db: Db): Promise<void> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version integer PRIMARY KEY, name text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  const applied = new Set(
    (await db.query<{ version: number }>("SELECT version FROM schema_migrations")).map((r) => Number(r.version)),
  );
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    if (m.sql) await db.exec(m.sql);
    if (m.run) await m.run(db);
    await db.query("INSERT INTO schema_migrations (version, name) VALUES ($1, $2)", [m.version, m.name]);
  }

  for (const src of DEFAULT_SOURCES) {
    await db.query(
      `INSERT INTO import_sources (id, adapter, name, config, enabled, interval_minutes)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6) ON CONFLICT (id) DO NOTHING`,
      [src.id, src.adapter, src.name, JSON.stringify(src.config), src.enabled, src.intervalMinutes],
    );
  }

  const [{ n }] = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM synonym_groups");
  if (n === 0) {
    for (const terms of DEFAULT_SYNONYM_GROUPS) {
      await db.query("INSERT INTO synonym_groups (terms) VALUES ($1)", [terms]);
    }
  }
}
