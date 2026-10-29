import { FRANCHISES, franchiseTagList } from "../memes/franchises";
import { CATEGORIES, type TaxonomyItem } from "../memes/taxonomy";
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

/** Words too common in captions to say anything about a meme's topic. */
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
  const found = FRANCHISES.filter((f) => f.terms.some((t) => norm.includes(` ${normalize(t)} `)));
  return { tags: found.flatMap(franchiseTagList), categories: found.length ? ["series-peliculas"] : [] };
}

/** Categories that say what kind of meme it is, not what it is about. */
export const GENERIC_CATEGORIES = new Set(["series-peliculas", "reacciones", "wholesome", "absurdo"]);

/**
 * Keyword rules for the workplace topics, matched as whole words or phrases (case and accents ignored)
 * against the title, caption/OCR text and tags. Broader than the taxonomy keywords, which also feed
 * the search index. Keep them unambiguous enough for captions ("notice" alone is "notice me").
 */
export const CATEGORY_RULES: Record<string, string[]> = {
  jefes: [
    "boss", "bosses", "manager", "managers", "jefe", "jefes", "jefa", "jefas", "gerente", "gerentes",
    "regional manager", "assistant to the", "supervisor", "supervisors", "supervisores", "supervisora", "ceo", "management",
  ],
  reuniones: [
    "meeting", "meetings", "reunion", "reuniones", "email", "emails", "correo", "correos", "could have been an email",
    "calendar", "zoom", "conference call", "videollamada",
  ],
  burnout: [
    "burnout", "burned out", "burnt out", "tired", "stress", "stressed", "deadline", "deadlines", "overtime", "exhausted",
    "agotado", "agotada", "estres", "estresado", "estresada", "cansado", "cansada", "cansancio", "horas extra",
  ],
  salario: [
    "salary", "salaries", "sueldo", "sueldos", "salario", "salarios", "raise", "money", "paid", "bonus", "aumento",
    "paycheck", "payday", "plata", "quincena", "aguinaldo",
  ],
  renuncias: [
    "quit", "quitting", "i quit", "resign", "resigned", "resignation", "renuncia", "renuncias", "renuncio", "renuncie",
    "renunciar", "two weeks notice", "fired", "laid off", "layoffs", "despido", "despidos", "despedido", "despedidos",
  ],
  lunes: ["monday", "mondays", "friday", "fridays", "lunes", "viernes", "weekend", "fin de semana", "finde"],
  remoto: ["remote", "home office", "wfh", "work from home", "working from home", "teletrabajo", "trabajo remoto", "desde casa"],
  // "code" and "production" alone are also dress codes and film productions (same for "codigo" and "produccion").
  programacion: [
    "deploy", "deployed", "deploying", "bug", "bugs", "coding", "my code", "the code", "your code", "code review", "legacy code",
    "prod", "in production", "to production", "server", "servers", "programmer", "programmers", "developer", "developers", "debug", "debugging",
    "programador", "programadores", "programadora", "mi codigo", "el codigo", "en produccion", "a produccion", "servidor", "servidores",
  ],
};

/** Topic categories the rules find in `text`; none when the meme already has a topic category. */
export function ruleCategories(text: string, current: string[]): string[] {
  if (current.some((c) => !GENERIC_CATEGORIES.has(c))) return [];
  const norm = ` ${normalize(text)} `;
  return Object.entries(CATEGORY_RULES)
    .filter(([, keywords]) => keywords.some((k) => norm.includes(` ${normalize(k)} `)))
    .map(([slug]) => slug);
}

/** Derives tags, categories and language from whatever text the source gave us. */
export function autoTag(c: Candidate, extraTags: string[] = []) {
  const text = [c.title, c.description, c.altText, ...(c.tags ?? [])].filter(Boolean).join(" ");
  const norm = normalize(text);
  const words = new Set(norm.split(" ").filter(Boolean));

  const franchise = franchiseTags(text);
  const categories = new Set([...(c.categories ?? []), ...franchise.categories]);
  for (const cat of CATEGORIES) if (keywordsOf(cat).some((k) => matches(norm, words, k))) categories.add(cat.slug);
  for (const slug of ruleCategories(text, [...categories])) categories.add(slug);

  const tags = new Set<string>([...(c.tags ?? []), ...extraTags, ...franchise.tags].map((t) => t.toLowerCase()));
  for (const w of normalize(c.title).split(" ")) {
    if (w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w)) tags.add(w);
    if (tags.size >= 12) break;
  }

  return {
    tags: [...tags].slice(0, 16),
    // Topic categories first, so the cap never drops them in favor of generic ones.
    categories: [...categories].sort((a, b) => Number(GENERIC_CATEGORIES.has(a)) - Number(GENERIC_CATEGORIES.has(b))).slice(0, 4),
    languages: c.languages ?? detectLanguage(text),
  };
}
