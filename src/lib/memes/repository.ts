import { query } from "../db";
import { storage } from "../storage";
import { clampText, normalize, parseList, slugify } from "../text";
import { isCategory, isEmotion, taxonomyKeywords } from "./taxonomy";
import type { Meme, MemeInput, MemeStatus } from "./types";

export type MemeRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  alt_text: string;
  ocr_text: string;
  source_url: string | null;
  source_name: string | null;
  credit: string | null;
  license: string;
  origin: Meme["origin"];
  storage_key: string | null;
  thumb_key: string | null;
  mime: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  languages: string[];
  tags: string[];
  synonyms: string[];
  categories: string[];
  emotions: string[];
  status: MemeStatus;
  status_reason: string | null;
  submitter_note: string | null;
  dominant_color: string | null;
  download_count: number;
  share_count: number;
  view_count: number;
  created_at: string | Date;
  updated_at: string | Date;
};

/** Columns needed to build a `Meme`; avoids shipping tsvectors around. */
export const MEME_COLUMNS = `id, slug, title, description, alt_text, ocr_text, source_url, source_name, credit, license,
  origin, storage_key, thumb_key, mime, format, width, height, bytes, sha256, languages, tags, synonyms, categories,
  emotions, status, status_reason, submitter_note, dominant_color, download_count, share_count, view_count,
  created_at, updated_at`;

const iso = (d: string | Date) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());

export function toMeme(row: MemeRow): Meme {
  const s = storage();
  const missing = "/missing.svg";
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    altText: row.alt_text || row.title,
    ocrText: row.ocr_text,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    credit: row.credit,
    license: row.license,
    origin: row.origin,
    format: row.format,
    mime: row.mime,
    width: Number(row.width),
    height: Number(row.height),
    bytes: Number(row.bytes),
    languages: row.languages ?? [],
    tags: row.tags ?? [],
    synonyms: row.synonyms ?? [],
    categories: row.categories ?? [],
    emotions: row.emotions ?? [],
    status: row.status,
    statusReason: row.status_reason,
    dominantColor: row.dominant_color,
    downloadCount: Number(row.download_count),
    shareCount: Number(row.share_count),
    viewCount: Number(row.view_count),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    imageUrl: row.storage_key ? s.publicUrl(row.storage_key) : missing,
    thumbUrl: row.thumb_key ? s.publicUrl(row.thumb_key) : row.storage_key ? s.publicUrl(row.storage_key) : missing,
    pageUrl: `/m/${row.id}`,
  };
}

/** Validates and normalizes user-supplied metadata into column values. */
export function sanitizeInput(input: MemeInput) {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.title = clampText(input.title, 160) || "Meme sin título";
  if (input.description !== undefined) out.description = clampText(input.description, 2000);
  if (input.altText !== undefined) out.alt_text = clampText(input.altText, 500);
  if (input.ocrText !== undefined) out.ocr_text = clampText(input.ocrText, 2000);
  if (input.sourceUrl !== undefined) out.source_url = cleanUrl(input.sourceUrl);
  if (input.sourceName !== undefined) out.source_name = clampText(input.sourceName, 120) || null;
  if (input.credit !== undefined) out.credit = clampText(input.credit, 160) || null;
  if (input.license !== undefined) out.license = clampText(input.license, 40) || "fair-use";
  if (input.languages !== undefined) out.languages = parseList(input.languages, 5).filter((l) => /^[a-z]{2}$/.test(l));
  if (input.tags !== undefined) out.tags = parseList(input.tags, 40);
  if (input.synonyms !== undefined) out.synonyms = parseList(input.synonyms, 40);
  if (input.categories !== undefined) out.categories = parseList(input.categories).filter(isCategory);
  if (input.emotions !== undefined) out.emotions = parseList(input.emotions).filter(isEmotion);
  if (input.status !== undefined) out.status = input.status;
  if (input.statusReason !== undefined) out.status_reason = clampText(input.statusReason, 500) || null;
  if (input.submitterNote !== undefined) out.submitter_note = clampText(input.submitterNote, 1000) || null;
  if (out.title) out.slug = slugify(String(out.title));
  return out;
}

export function cleanUrl(input: unknown): string | null {
  const raw = clampText(input, 2000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function getMemeRow(id: string): Promise<MemeRow | null> {
  const rows = await query<MemeRow>(`SELECT ${MEME_COLUMNS} FROM memes WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/** Public lookup: only active memes are visible. */
export async function getPublicMeme(id: string): Promise<Meme | null> {
  const row = await getMemeRow(id);
  return row && row.status === "active" ? toMeme(row) : null;
}

export async function updateMeme(id: string, input: MemeInput): Promise<Meme | null> {
  const values = sanitizeInput(input);
  const current = await getMemeRow(id);
  if (!current) return null;
  // Keep the taxonomy keywords in sync so label searches ("cansado") keep working.
  const emotions = (values.emotions as string[] | undefined) ?? current.emotions;
  const categories = (values.categories as string[] | undefined) ?? current.categories;
  values.keywords = taxonomyKeywords(emotions, categories);
  values.updated_at = new Date().toISOString();

  const keys = Object.keys(values);
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const rows = await query<MemeRow>(`UPDATE memes SET ${sets} WHERE id = $1 RETURNING ${MEME_COLUMNS}`, [
    id,
    ...keys.map((k) => values[k]),
  ]);
  return rows[0] ? toMeme(rows[0]) : null;
}

export async function setStatus(id: string, status: MemeStatus, reason: string | null = null) {
  const rows = await query<MemeRow>(
    `UPDATE memes SET status = $2, status_reason = $3, updated_at = now() WHERE id = $1 RETURNING ${MEME_COLUMNS}`,
    [id, status, reason],
  );
  return rows[0] ? toMeme(rows[0]) : null;
}

/**
 * Takedown: deletes the stored files but keeps the row (status `removed`) so the
 * SHA-256 / perceptual hash keep blocking re-uploads of the same image.
 */
export async function removeMeme(id: string, reason: string) {
  const row = await getMemeRow(id);
  if (!row) return null;
  const s = storage();
  await Promise.all([row.storage_key, row.thumb_key].filter(Boolean).map((k) => s.delete(k!)));
  return setStatusAndClearFiles(id, reason);
}

async function setStatusAndClearFiles(id: string, reason: string) {
  const rows = await query<MemeRow>(
    `UPDATE memes SET status = 'removed', status_reason = $2, storage_key = NULL, thumb_key = NULL, updated_at = now()
     WHERE id = $1 RETURNING ${MEME_COLUMNS}`,
    [id, reason],
  );
  return rows[0] ? toMeme(rows[0]) : null;
}

const COUNTERS = { download: "download_count", share: "share_count", view: "view_count" } as const;

export async function incrementCounter(id: string, counter: keyof typeof COUNTERS) {
  await query(`UPDATE memes SET ${COUNTERS[counter]} = ${COUNTERS[counter]} + 1 WHERE id = $1 AND status = 'active'`, [id]);
}

/** Memes sharing tags, emotions or categories with the given one. */
export async function relatedMemes(meme: Pick<Meme, "id" | "tags" | "emotions" | "categories">, limit = 12) {
  const rows = await query<MemeRow>(
    `SELECT ${MEME_COLUMNS},
       (cardinality(ARRAY(SELECT unnest(tags) INTERSECT SELECT unnest($2::text[]))) * 3
      + cardinality(ARRAY(SELECT unnest(emotions) INTERSECT SELECT unnest($3::text[]))) * 2
      + cardinality(ARRAY(SELECT unnest(categories) INTERSECT SELECT unnest($4::text[])))) AS overlap
     FROM memes
     WHERE status = 'active' AND id <> $1
       AND (tags && $2::text[] OR emotions && $3::text[] OR categories && $4::text[])
     ORDER BY overlap DESC, download_count DESC, created_at DESC
     LIMIT $5`,
    [meme.id, meme.tags, meme.emotions, meme.categories, limit],
  );
  return rows.map(toMeme);
}

export async function randomMemeId(): Promise<string | null> {
  const rows = await query<{ id: string }>(
    "SELECT id FROM memes WHERE status = 'active' ORDER BY random() LIMIT 1",
  );
  return rows[0]?.id ?? null;
}

export type AdminListParams = { q?: string; status?: string; limit?: number; offset?: number };

export async function listForAdmin({ q, status, limit = 50, offset = 0 }: AdminListParams) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (status && status !== "all") {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  const term = normalize(q);
  if (term) {
    params.push(`%${term}%`);
    where.push(`(search_text LIKE $${params.length} OR id = $${params.length + 1})`);
    params.push(q?.trim());
  }
  params.push(limit, offset);
  const rows = await query<MemeRow & { total: number; open_reports: number }>(
    `SELECT ${MEME_COLUMNS}, count(*) OVER()::int AS total,
       (SELECT count(*)::int FROM reports r WHERE r.meme_id = memes.id AND r.status = 'open') AS open_reports
     FROM memes ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return {
    total: rows[0]?.total ?? 0,
    items: rows.map((r) => ({ ...toMeme(r), openReports: r.open_reports, sha256: r.sha256 })),
  };
}

export async function stats() {
  type Counts = Record<"active" | "pending" | "hidden" | "removed" | "rejected" | "downloads" | "shares" | "views" | "open_reports" | "distinct_queries", number> & {
    bytes: string;
  };
  const [counts] = await query<Counts>(`
    SELECT
      count(*) FILTER (WHERE status = 'active')::int   AS active,
      count(*) FILTER (WHERE status = 'pending')::int  AS pending,
      count(*) FILTER (WHERE status = 'hidden')::int   AS hidden,
      count(*) FILTER (WHERE status = 'removed')::int  AS removed,
      count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
      coalesce(sum(download_count), 0)::int AS downloads,
      coalesce(sum(share_count), 0)::int    AS shares,
      coalesce(sum(view_count), 0)::int     AS views,
      coalesce(sum(bytes) FILTER (WHERE storage_key IS NOT NULL), 0)::bigint::text AS bytes,
      (SELECT count(*)::int FROM reports WHERE status = 'open') AS open_reports,
      (SELECT count(*)::int FROM search_log) AS distinct_queries
    FROM memes`);
  const top = await query<MemeRow>(
    `SELECT ${MEME_COLUMNS} FROM memes WHERE status = 'active' ORDER BY download_count DESC, view_count DESC LIMIT 8`,
  );
  const topSearches = await query<{ display: string; count: number; last_results: number }>(
    "SELECT display, count, last_results FROM search_log ORDER BY count DESC LIMIT 12",
  );
  const zeroSearches = await query<{ display: string; count: number }>(
    "SELECT display, count FROM search_log WHERE last_results = 0 ORDER BY count DESC, last_at DESC LIMIT 12",
  );
  const byEmotion = await query<{ emotion: string; n: number }>(
    `SELECT e AS emotion, count(*)::int AS n FROM memes, unnest(emotions) e WHERE status = 'active'
     GROUP BY e ORDER BY n DESC`,
  );
  return { counts: { ...counts, bytes: Number(counts.bytes) }, top: top.map(toMeme), topSearches, zeroSearches, byEmotion };
}
