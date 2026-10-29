import { query } from "../db";
import { MEME_COLUMNS, toMeme, type MemeRow } from "../memes/repository";
import { CATEGORIES, isCategory } from "../memes/taxonomy";
import type { Meme } from "../memes/types";
import { normalize } from "../text";
import { buildSynonymIndex, parseQuery, type SynonymIndex } from "./query";

export type SortMode = "relevance" | "popular" | "new";

export type SearchParams = {
  q?: string;
  category?: string;
  format?: string;
  lang?: string;
  sort?: SortMode;
  page?: number;
  limit?: number;
  /** Set by the client when page 1 came back relaxed (its `minUnits`), so later pages use the same query. */
  relaxed?: number;
};

export type SearchResult = {
  items: Meme[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  /**
   * True when fewer than MIN_EXACT_RESULTS memes matched every word, so the list was completed with
   * memes matching some of the words (listed after the exact matches, flagged `partialMatch`).
   */
  relaxed: boolean;
  /** How many results match the whole query (all of them unless `relaxed`). */
  exactTotal: number;
  /** For relaxed results: how many of the words a partial match had to share. */
  minUnits: number;
  tookMs: number;
  query: string;
  expandedTerms: string[];
};

const SYNONYM_TTL_MS = 60_000;
/** Below this many exact matches, a search is completed with memes matching some of the words. */
const MIN_EXACT_RESULTS = 5;
let synonymCache: { at: number; index: SynonymIndex } | null = null;

export async function synonymIndex(): Promise<SynonymIndex> {
  if (synonymCache && Date.now() - synonymCache.at < SYNONYM_TTL_MS) return synonymCache.index;
  const rows = await query<{ terms: string[] }>("SELECT terms FROM synonym_groups");
  synonymCache = { at: Date.now(), index: buildSynonymIndex(rows.map((r) => r.terms)) };
  return synonymCache.index;
}

export function invalidateSynonyms() {
  synonymCache = null;
}

/** Accepts a category slug ("reuniones") or its label in either language ("Reuniones", "Meetings"). */
function resolveCategory(value: string | undefined) {
  if (!value) return undefined;
  if (isCategory(value)) return value;
  const n = normalize(value);
  return CATEGORIES.find((c) => normalize(c.es) === n || normalize(c.en) === n)?.slug;
}

/** Reads search params from a URL / Next searchParams object, ignoring anything unknown. */
export function parseSearchParams(input: Record<string, string | string[] | undefined> | URLSearchParams): SearchParams {
  const get = (k: string) => {
    const v = input instanceof URLSearchParams ? input.get(k) : input[k];
    return (Array.isArray(v) ? v[0] : v) ?? undefined;
  };
  const sort = get("sort");
  const format = get("format");
  return {
    q: get("q")?.slice(0, 200),
    category: resolveCategory(get("category")),
    format: format && ["jpg", "png", "webp"].includes(format) ? format : undefined,
    lang: get("lang") === "es" || get("lang") === "en" ? get("lang") : undefined,
    sort: sort === "popular" || sort === "new" ? sort : "relevance",
    page: Math.max(1, Math.min(500, Number(get("page")) || 1)),
    relaxed: Math.max(0, Math.min(16, Math.floor(Number(get("relaxed")) || 0))),
  };
}

export async function search(params: SearchParams): Promise<SearchResult> {
  const started = performance.now();
  const limit = Math.max(1, Math.min(60, params.limit ?? 30));
  const page = Math.max(1, params.page ?? 1);
  const offset = (page - 1) * limit;
  const parsed = parseQuery(params.q ?? "", await synonymIndex());

  const filters: string[] = ["m.status = 'active'"];
  const values: unknown[] = [];
  const add = (v: unknown) => {
    values.push(v);
    return `$${values.length}`;
  };
  if (params.category) filters.push(`m.categories @> ARRAY[${add(params.category)}]::text[]`);
  if (params.format) filters.push(`m.format = ${add(params.format)}`);
  // Memes without text (blank templates) fit either language.
  if (params.lang) filters.push(`(m.languages @> ARRAY[${add(params.lang)}]::text[] OR m.languages = '{}')`);

  /**
   * One way of matching the text. `fuzzy` adds trigram matches (typo tolerance). `exactFirst` (the
   * strict query) ranks the memes that match it above the rest and flags the others as partial.
   */
  type Mode = { ts: string; stemmed: string; fuzzy: boolean; exactFirst?: { ts: string; stemmed: string }; minUnits?: number };

  const run = async (mode: Mode | null, probe = false) => {
    const v = [...values];
    const p = (x: unknown) => {
      v.push(x);
      return `$${v.length}`;
    };
    const tsquery = (ts: string, stemmed: string) => {
      const t = p(ts);
      const st = stemmed ? p(stemmed) : null;
      return st ? `(to_tsquery('simple', ${t}) || to_tsquery('english', ${st}) || to_tsquery('spanish', ${st}))` : `to_tsquery('simple', ${t})`;
    };
    let score = "0";
    let exact = "true";
    let units = "0";
    const where = [...filters];
    if (mode?.ts) {
      const tsq = tsquery(mode.ts, mode.stemmed);
      const norm = p(parsed.normalized);
      // Trigram matching only for queries long enough to carry signal; it is what tolerates typos.
      const fuzzy = mode.fuzzy && parsed.normalized.length >= 3 ? ` OR ${norm} <% m.search_text` : "";
      if (mode.minUnits && mode.minUnits > 1) {
        // Partial matches must share several of the words: one short word alone ("ser" → "series") matches half the catalog.
        units = parsed.unitQueries.map((u) => `(m.search_doc @@ to_tsquery('simple', ${p(u)}))::int`).join(" + ");
        where.push(`((m.search_doc @@ ${tsq} AND ${units} >= ${p(mode.minUnits)})${fuzzy})`);
      } else {
        where.push(`(m.search_doc @@ ${tsq}${fuzzy})`);
      }
      if (mode.exactFirst) exact = `(m.search_doc @@ ${tsquery(mode.exactFirst.ts, mode.exactFirst.stemmed)})`;
      score = `(ts_rank_cd(m.search_doc, ${tsq}, 32) * 4
        + word_similarity(${norm}, m.search_text)
        + CASE WHEN md_norm(m.title) LIKE '%' || ${norm} || '%' THEN 0.6 ELSE 0 END
        + ln(1 + m.download_count) * 0.04)`;
    } else {
      // Browsing without a query ("Populares"): popularity with a gentle freshness boost.
      score = `(ln(1 + m.download_count + m.share_count * 2) + 2 / (1 + extract(epoch FROM now() - m.created_at) / 604800))`;
    }
    // With no text there is nothing to be relevant to: the default view (home or a category) shows
    // the newest memes first, so freshly imported ones are visible right away.
    const order =
      params.sort === "new" || (!mode?.ts && params.sort !== "popular")
        ? "m.created_at DESC, m.id"
        : params.sort === "popular"
          ? "m.download_count DESC, score DESC, m.id"
          : "score DESC, m.created_at DESC, m.id";
    // The inner query scores and flags each match; the outer one orders exact matches first and counts.
    const sql = `SELECT m.*, count(*) OVER()::int AS total_count, count(*) FILTER (WHERE m.exact_match) OVER()::int AS exact_count
      FROM (
        SELECT ${MEME_COLUMNS.split(",").map((c) => `m.${c.trim()}`).join(", ")}, ${score} AS score, ${exact} AS exact_match,
          ${units} AS matched_units
        FROM memes m WHERE ${where.join(" AND ")}
      ) m
      ORDER BY m.exact_match DESC, m.matched_units DESC, ${order} LIMIT ${p(probe ? 1 : limit)} OFFSET ${p(probe ? 0 : offset)}`;
    return query<MemeRow & { exact_match: boolean; total_count: number; exact_count: number }>(sql, v);
  };

  type Rows = Awaited<ReturnType<typeof run>>;
  /** Matches of a mode; past its last page the rows are empty, so ask for its first row instead. */
  const totalOf = async (mode: Mode, rows: Rows) => rows[0]?.total_count ?? (page > 1 ? ((await run(mode, true))[0]?.total_count ?? 0) : 0);

  const exactMode: Mode = { ts: parsed.all, stemmed: parsed.allStemmed, fuzzy: false };
  const fuzzyMode: Mode = { ts: parsed.all, stemmed: parsed.allStemmed, fuzzy: true };
  // Some of the words, with typo tolerance; memes that match the whole query still come first.
  const mixedMode = (minUnits: number): Mode => ({
    ts: parsed.any,
    stemmed: parsed.anyStemmed,
    fuzzy: true,
    exactFirst: { ts: parsed.all, stemmed: parsed.allStemmed },
    minUnits,
  });
  // With three or more words a partial match first needs half of them, then any one.
  const levels = [...new Set([parsed.units.length >= 3 ? Math.ceil(parsed.units.length / 2) : 1, 1])];

  let relaxed = false;
  let minUnits = 0;
  let rows: Rows;
  if (!parsed.all) {
    rows = await run(null);
  } else if (params.relaxed) {
    // Later pages of a list that page 1 already completed with partial matches.
    minUnits = params.relaxed;
    rows = await run(mixedMode(minUnits));
    relaxed = true;
  } else {
    // Exact (prefix + synonyms + stemming) first; typo tolerance only when that finds nothing, so a
    // query never drags in every meme that merely looks similar.
    rows = await run(exactMode);
    let strictTotal = await totalOf(exactMode, rows);
    if (!strictTotal) {
      rows = await run(fuzzyMode);
      strictTotal = await totalOf(fuzzyMode, rows);
    }
    // Too few exact matches: complete the list with memes that match some of the words.
    if (strictTotal < MIN_EXACT_RESULTS && page === 1) {
      for (const level of levels) {
        const mixed = await run(mixedMode(level));
        if ((mixed[0]?.total_count ?? 0) > strictTotal) {
          rows = mixed;
          relaxed = true;
          minUnits = level;
          break;
        }
      }
    }
  }
  const total = rows[0]?.total_count ?? 0;
  if (parsed.normalized && page === 1) void logSearch(params.q ?? "", parsed.normalized, total);

  return {
    items: rows.map((r) => (relaxed && !r.exact_match ? { ...toMeme(r), partialMatch: true } : toMeme(r))),
    total,
    exactTotal: relaxed ? (rows[0]?.exact_count ?? 0) : total,
    minUnits,
    page,
    limit,
    hasMore: offset + rows.length < total,
    relaxed,
    tookMs: Math.round(performance.now() - started),
    query: params.q ?? "",
    expandedTerms: [...new Set(parsed.units.flatMap((u) => u.variants))].slice(0, 24),
  };
}

async function logSearch(raw: string, normalized: string, results: number) {
  if (normalized.length > 80) return;
  try {
    await query(
      `INSERT INTO search_log (query, display, count, last_results, last_at) VALUES ($1, $2, 1, $3, now())
       ON CONFLICT (query) DO UPDATE SET count = search_log.count + 1, last_results = $3, last_at = now(), display = $2`,
      [normalized, raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80), results],
    );
  } catch {
    // Logging must never break a search.
  }
}

export type Suggestion = {
  label: string;
  kind: "query" | "tag" | "title" | "category";
  /** For taxonomy suggestions: the filter to apply instead of a text query. */
  filter?: { category?: string };
};

const suggestCache = new Map<string, { at: number; items: Suggestion[] }>();

export async function suggest(input: string, limit = 8): Promise<Suggestion[]> {
  const prefix = normalize(input).slice(0, 60);
  if (!prefix) return [];
  const cached = suggestCache.get(prefix);
  if (cached && Date.now() - cached.at < 30_000) return cached.items;

  const taxonomy: Suggestion[] = [
    ...CATEGORIES.filter((c) => [c.en, c.es].some((l) => normalize(l).startsWith(prefix))).map((c) => ({
      label: c.es,
      kind: "category" as const,
      filter: { category: c.slug },
    })),
  ].slice(0, 3);

  const rows = await query<{ term: string; kind: Suggestion["kind"]; n: string }>(
    `WITH terms AS (
       SELECT t AS term, 'tag' AS kind, count(*)::float AS weight FROM memes, unnest(tags) t
         WHERE status = 'active' GROUP BY t
       UNION ALL
       SELECT display, 'query', count * 2 FROM search_log WHERE last_results > 0 AND count >= 2
       UNION ALL
       SELECT title, 'title', (1 + download_count)::float / 3 FROM memes WHERE status = 'active'
     ), scored AS (
       SELECT term, kind, weight, md_norm(term) AS n FROM terms
     )
     SELECT term, kind, n FROM scored
     WHERE n LIKE $1 || '%' OR n LIKE '% ' || $1 || '%' OR (length($1) >= 4 AND n % $1)
     ORDER BY (n LIKE $1 || '%') DESC, weight DESC, length(n)
     LIMIT 40`,
    [prefix],
  );

  const seen = new Set<string>();
  const items: Suggestion[] = [...taxonomy];
  for (const r of rows) {
    if (seen.has(r.n) || r.n === prefix) continue;
    seen.add(r.n);
    items.push({ label: r.kind === "title" ? r.term : r.term.toLowerCase(), kind: r.kind });
    if (items.length >= limit) break;
  }
  suggestCache.set(prefix, { at: Date.now(), items });
  if (suggestCache.size > 500) suggestCache.delete(suggestCache.keys().next().value!);
  return items;
}
