import { normalize } from "../text";

/** Words that never constrain a search on their own (they still count for trigram/phrase matching). */
export const STOPWORDS = new Set(
  (
    "a al an and are as at be by con cuando de del el en es esta este for from i in is it la las le lo los me mi my " +
    "no of on or para por que se sin su the to un una uno y yo when when you your tu te"
  ).split(" "),
);

export type SynonymIndex = { byTerm: Map<string, string[][]>; phrases: string[] };

export function buildSynonymIndex(groups: string[][]): SynonymIndex {
  const byTerm = new Map<string, string[][]>();
  const phrases = new Set<string>();
  for (const raw of groups) {
    const group = [...new Set(raw.map(normalize).filter(Boolean))];
    for (const term of group) {
      byTerm.set(term, [...(byTerm.get(term) ?? []), group]);
      if (term.includes(" ")) phrases.add(term);
    }
  }
  return { byTerm, phrases: [...phrases].sort((a, b) => b.split(" ").length - a.split(" ").length) };
}

export type ParsedQuery = {
  normalized: string;
  /** One entry per meaningful unit: the unit plus its synonyms. */
  units: { term: string; variants: string[] }[];
  /** tsquery text requiring every unit (AND). Empty when nothing is searchable. */
  all: string;
  /** tsquery text requiring any unit (OR), used as a relaxed fallback. */
  any: string;
  /**
   * The same for the stemmed configs (english/spanish), without phrases that contain stopwords:
   * those configs drop "the" from "the office", which would turn the show into any "office".
   * Empty when a unit has nothing left (then only the `simple` config is used).
   */
  allStemmed: string;
  anyStemmed: string;
};

const MAX_VARIANTS = 16;

const lexeme = (variant: string) => {
  const words = variant.split(" ").filter(Boolean);
  if (words.length > 1) return `(${words.join(" <-> ")})`;
  return words[0].length >= 3 ? `${words[0]}:*` : words[0];
};

/**
 * Turns free text ("cuando el jefe dice reunion a las 5") into tsquery text with
 * bilingual synonym expansion. Multi-word synonyms ("home office") are matched as phrases.
 */
export function parseQuery(raw: string, index: SynonymIndex): ParsedQuery {
  const normalized = normalize(raw).slice(0, 200);
  const words = normalized.split(" ").filter(Boolean).slice(0, 16);

  const tokens: string[] = [];
  for (let i = 0; i < words.length; ) {
    const phrase = index.phrases.find((p) => {
      const n = p.split(" ").length;
      return words.slice(i, i + n).join(" ") === p;
    });
    if (phrase) {
      tokens.push(phrase);
      i += phrase.split(" ").length;
    } else {
      tokens.push(words[i]);
      i += 1;
    }
  }

  const meaningful = tokens.filter((t) => !STOPWORDS.has(t));
  const chosen = meaningful.length ? meaningful : tokens;
  const units = chosen.map((term, i) => {
    const variants = new Set([term]);
    for (const group of index.byTerm.get(term) ?? []) group.forEach((v) => variants.add(v));
    // The last word is usually still being typed: let "reuni" pull in the "reunion" group.
    if (i === chosen.length - 1 && term.length >= 4 && variants.size === 1) {
      for (const [key, groups] of index.byTerm) {
        if (key.startsWith(term)) groups.forEach((g) => g.forEach((v) => variants.add(v)));
        if (variants.size >= MAX_VARIANTS) break;
      }
    }
    return { term, variants: [...variants].slice(0, MAX_VARIANTS) };
  });

  const groups = units.map((u) => `(${u.variants.map(lexeme).join(" | ")})`);
  const stemmed = units
    .map((u) => u.variants.filter((v) => !v.includes(" ") || !v.split(" ").some((w) => STOPWORDS.has(w))))
    .map((variants) => (variants.length ? `(${variants.map(lexeme).join(" | ")})` : ""));
  return {
    normalized,
    units,
    all: groups.join(" & "),
    any: groups.join(" | "),
    allStemmed: stemmed.every(Boolean) ? stemmed.join(" & ") : "",
    anyStemmed: stemmed.filter(Boolean).join(" | "),
  };
}
