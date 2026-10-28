/**
 * Text helpers shared by the search engine, ingestion and UI.
 * `normalize` must stay in sync with the SQL function `md_norm` (see db/schema.ts):
 * lowercase, strip diacritics, keep only [a-z0-9] separated by single spaces.
 */
export function normalize(input: string | null | undefined): string {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(input: string, max = 60): string {
  const s = normalize(input).replace(/ /g, "-").slice(0, max).replace(/-+$/, "");
  return s || "meme";
}

/** Splits "a, b ,c" (or an array) into a clean, de-duplicated list of lowercase terms. */
export function parseList(input: unknown, max = 40): string[] {
  const raw = Array.isArray(input) ? input.flatMap((v) => String(v).split(",")) : String(input ?? "").split(",");
  const out: string[] = [];
  for (const item of raw) {
    const v = item.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
    if (v && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
  if (!base) return "Meme sin título";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2).replace(".", ",")} MB`;
}

export function clampText(input: unknown, max: number): string {
  return String(input ?? "").trim().slice(0, max);
}
