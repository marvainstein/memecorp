import { FRANCHISES, franchiseTagList } from "../memes/franchises";
import { CATEGORIES, EMOTIONS, type TaxonomyItem } from "../memes/taxonomy";
import { STOPWORDS } from "../search/query";
import { DEFAULT_SYNONYM_GROUPS } from "../search/synonyms";
import { normalize } from "../text";
import type { Candidate } from "./types";

const ES_MARKERS = new Set("de la que el en los las por con para una cuando mi tu pero como mas esta este jefe trabajo lunes reunion sueldo yo".split(" "));
const EN_MARKERS = new Set("the and when my to of is you me i it your this that at work boss monday meeting".split(" "));

export function detectLanguage(text: string): string[] {
  const words = normalize(text).split(" ");
  let es = /[ñáéíóú¿¡]/i.test(text) ? 2 : 0;
  let en = 0;
  for (const w of words) {
    if (ES_MARKERS.has(w)) es++;
    if (EN_MARKERS.has(w)) en++;
  }
  if (!es && !en) return [];
  return es > en ? ["es"] : ["en"];
}

/** Words too common in captions to say anything about a meme's emotion or topic. */
const GENERIC = new Set(["what", "que", "same", "mood", "smile", "face", "cara", "todo bien", "people", "call", "meet", "daily", "pay", "money", "it", "tv"]);

/** Every normalized keyword that points at a taxonomy item. */
const keywordsOf = (item: TaxonomyItem) =>
  [item.slug.replace(/-/g, " "), item.en, item.es, ...item.keywords]
    .map(normalize)
    .filter((k) => k.length >= 2 && !STOPWORDS.has(k) && !GENERIC.has(k));

function matches(textNorm: string, words: Set<string>, keyword: string) {
  if (keyword.includes(" ")) return ` ${textNorm} `.includes(` ${keyword} `);
  if (words.has(keyword)) return true;
  // Light stemming: "meetings" ↔ "meeting", "reuniones" ↔ "reunion".
  return keyword.length >= 5 && [...words].some((w) => w.length >= 5 && (w.startsWith(keyword) || keyword.startsWith(w)));
}

/** Terms that mark a post as office/work humor, built from the taxonomy and synonym groups. */
const WORK_TERMS = [
  ...new Set(
    [
      ...CATEGORIES.filter((c) => !["reacciones", "wholesome", "absurdo", "series-peliculas"].includes(c.slug)).flatMap(keywordsOf),
      ...DEFAULT_SYNONYM_GROUPS.filter((g) =>
        ["jefe", "reunion", "email", "lunes", "sueldo", "renuncia", "trabajo", "remoto", "companero", "rrhh", "excel", "powerpoint", "programacion", "deploy", "cliente", "deadline", "productividad", "sinergia", "burnout", "vacaciones", "despido", "entrevista"].includes(g[0]),
      ).flatMap((g) => g.map(normalize)),
      "corporate", "office", "intern", "linkedin", "standup", "jira", "slack", "ticket", "overtime", "9 to 5", "nine to five", "payday", "promotion", "ascenso", "oficina",
    ].filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !GENERIC.has(t)),
  ),
];

/**
 * Posts we never import: slurs and hate terms, sexual content, gore. Kept short on purpose;
 * extend it with IMPORT_BLOCKLIST. Matches whole normalized words / phrases.
 */
const BLOCKLIST = ["nsfw", "nude", "nudes", "porn", "hentai", "onlyfans", "gore", "nazi", "nazis", "hitler", "rape", "faggot", "fag", "retard", "retarded", "nigger", "nigga", "tranny", "kike", "spic", "chink", "sudaca", "puto", "maricon", "negro de mierda", "pedo", "pedophile"];

export function isBlocked(text: string, extra: string[] = []): boolean {
  const norm = ` ${normalize(text)} `;
  return [...BLOCKLIST, ...extra].some((w) => norm.includes(` ${normalize(w)} `));
}

export function isWorkRelated(text: string): boolean {
  const norm = normalize(text);
  const words = new Set(norm.split(" "));
  return WORK_TERMS.some((t) => matches(norm, words, t));
}

/** Tags of every workplace show the text mentions (see FRANCHISES), so searching the show's name finds it. */
export function franchiseTags(text: string) {
  const norm = ` ${normalize(text)} `;
  const found = FRANCHISES.filter((f) => [...f.terms, ...f.names].some((t) => norm.includes(` ${normalize(t)} `)));
  return { tags: found.flatMap(franchiseTagList), categories: found.length ? ["series-peliculas"] : [] };
}

/** Derives tags, emotions, categories and language from whatever text the source gave us. */
export function autoTag(c: Candidate, extraTags: string[] = []) {
  const text = [c.title, c.description, c.altText, ...(c.tags ?? [])].filter(Boolean).join(" ");
  const norm = normalize(text);
  const words = new Set(norm.split(" ").filter(Boolean));

  const emotions = new Set(c.emotions ?? []);
  for (const e of EMOTIONS) if (keywordsOf(e).some((k) => matches(norm, words, k))) emotions.add(e.slug);
  const franchise = franchiseTags(text);
  const categories = new Set([...(c.categories ?? []), ...franchise.categories]);
  for (const cat of CATEGORIES) if (keywordsOf(cat).some((k) => matches(norm, words, k))) categories.add(cat.slug);

  const tags = new Set<string>([...(c.tags ?? []), ...extraTags, ...franchise.tags].map((t) => t.toLowerCase()));
  for (const w of normalize(c.title).split(" ")) {
    if (w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w)) tags.add(w);
    if (tags.size >= 12) break;
  }

  return {
    tags: [...tags].slice(0, 16),
    emotions: [...emotions].slice(0, 5),
    categories: [...categories].slice(0, 4),
    languages: c.languages?.length ? c.languages : detectLanguage(text),
  };
}
