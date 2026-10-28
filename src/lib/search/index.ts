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
  /** Set by the client when page 1 came back relaxed, so later pages use the same OR query. */
  relaxed?: boolean;
};

export type SearchResult = {
  items: Meme[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  /** True when no meme matched every word and results come from an OR fallback. */
  relaxed: boolean;
  tookMs: number;
  query: string;
  expandedTerms: string[];
};

const SYNONYM_TTL_MS = 60_000;
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
    category: isCategory(get("category") ?? "") ? get("category") : undefined,
    format: format && ["jpg", "png", "webp"].includes(format) ? format : undefined,
    lang: get("lang") === "es" || get("lang") === "en" ? get("lang") : undefined,
    sort: sort === "popular" || sort === "new" ? sort : "relevance",
    page: Math.max(1, Math.min(500, Number(get("page")) || 1)),
    relaxed: get("relaxed") === "1",
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
  if (params.lang) filters.push(`m.languages @> ARRAY[${add(params.lang)}]::text[]`);

  /** `fuzzy` adds trigram matches (typo tolerance); it is only used when exact matching finds nothing. */
  const run = async (tsText: string | null, stemmed = "", fuzzyMatch = false, probe = false) => {
    const v = [...values];
    const p = (x: unknown) => {
      v.push(x);
      return `$${v.length}`;
    };
    let score = "0";
    const where = [...filters];
    if (tsText) {
      const ts = p(tsText);
      const norm = p(parsed.normalized);
      const st = stemmed ? p(stemmed) : null;
      const tsq = st
        ? `(to_tsquery('simple', ${ts}) || to_tsquery('english', ${st}) || to_tsquery('spanish', ${st}))`
        : `to_tsquery('simple', ${ts})`;
      // Trigram matching only for queries long enough to carry signal; it is what tolerates typos.
      const fuzzy = fuzzyMatch && parsed.normalized.length >= 3 ? ` OR ${norm} <% m.search_text` : "";
      where.push(`(m.search_doc @@ ${tsq}${fuzzy})`);
      score = `(ts_rank_cd(m.search_doc, ${tsq}, 32) * 4
        + word_similarity(${norm}, m.search_text)
        + CASE WHEN md_norm(m.title) LIKE '%' || ${norm} || '%' THEN 0.6 ELSE 0 END
        + ln(1 + m.download_count) * 0.04)`;
    } else {
      // Browsing without a query: popularity with a gentle freshness boost.
      score = `(ln(1 + m.download_count + m.share_count * 2) + 2 / (1 + extract(epoch FROM now() - m.created_at) / 604800))`;
    }
    const order =
      params.sort === "new"
        ? "m.created_at DESC, m.id"
        : params.sort === "popular"
          ? "m.download_count DESC, score DESC, m.id"
          : "score DESC, m.created_at DESC, m.id";
    const sql = `SELECT ${MEME_COLUMNS.split(",").map((c) => `m.${c.trim()}`).join(", ")},
        ${score} AS score, count(*) OVER()::int AS total_count
      FROM memes m WHERE ${where.join(" AND ")}
      ORDER BY ${order} LIMIT ${p(probe ? 1 : limit)} OFFSET ${p(probe ? 0 : offset)}`;
    return query<MemeRow & { total_count: number }>(sql, v);
  };

  // Exact (prefix + synonyms + stemming) first; typo tolerance only when that finds nothing, so a
  // query never drags in every meme that merely looks similar. Then "any word" as a last resort.
  let relaxed = Boolean(params.relaxed && parsed.units.length > 1);
  const attempts: [string, string, boolean, boolean][] = relaxed
    ? [[parsed.any, parsed.anyStemmed, false, true], [parsed.any, parsed.anyStemmed, true, true]]
    : [
        [parsed.all, parsed.allStemmed, false, false],
        [parsed.all, parsed.allStemmed, true, false],
        ...(parsed.units.length > 1 ? ([[parsed.any, parsed.anyStemmed, true, true]] as [string, string, boolean, boolean][]) : []),
      ];
  let rows: Awaited<ReturnType<typeof run>> = [];
  for (const [ts, stemmed, fuzzy, isRelaxed] of attempts) {
    rows = await run(ts || null, stemmed, fuzzy);
    // Past the last page of a mode that did match, stop there instead of falling through to a broader one.
    if (rows.length || (page > 1 && (await run(ts || null, stemmed, fuzzy, true)).length)) {
      relaxed = isRelaxed;
      break;
    }
  }
  const total = rows[0]?.total_count ?? 0;
  if (parsed.normalized && page === 1) void logSearch(params.q ?? "", parsed.normalized, total);

  return {
    items: rows.map(toMeme),
    total,
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
