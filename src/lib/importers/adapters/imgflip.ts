import * as cheerio from "cheerio";
import { FRANCHISES, franchiseById, franchiseTagList, type Franchise } from "../../memes/franchises";
import { categoryLabel } from "../../memes/taxonomy";
import { normalize } from "../../text";
import { TOPIC_SEARCHES, type TopicSearch } from "../../memes/topics";
import type { Adapter, AdapterContext, Candidate } from "../types";

/** Hand-written tags for well-known reaction templates (by Imgflip template name). */
const KNOWN: Record<string, { tags: string[]; categories?: string[] }> = {
  "Drake Hotline Bling": { tags: ["drake", "preferencia", "prefer", "esto no esto si"] },
  "Two Buttons": { tags: ["dos botones", "decision", "dilema", "sweating"] },
  "Distracted Boyfriend": { tags: ["novio distraido", "tentacion", "distracted"] },
  "This Is Fine": { tags: ["this is fine", "todo bien", "incendio", "perro"] },
  "Disaster Girl": { tags: ["disaster girl", "incendio", "nena"] },
  "Roll Safe Think About It": { tags: ["think about it", "pensalo", "logica"] },
  "Hide the Pain Harold": { tags: ["harold", "dolor", "sonrisa falsa", "stock photo"] },
  "Woman Yelling At Cat": { tags: ["gato", "gritando", "discusion"] },
  "Surprised Pikachu": { tags: ["pikachu", "sorpresa", "obvio"] },
  "Change My Mind": { tags: ["change my mind", "opinion", "debate"] },
  "Mocking Spongebob": { tags: ["bob esponja", "burla", "spongebob"] },
  "Left Exit 12 Off Ramp": { tags: ["salida", "volantazo", "decision"] },
  "Gru's Plan": { tags: ["gru", "plan", "plan fallido"] },
  "Is This A Pigeon": { tags: ["paloma", "pigeon", "confusion"] },
  "Expanding Brain": { tags: ["cerebro", "galaxy brain", "niveles"] },
  "Bernie I Am Once Again Asking For Your Support": { tags: ["bernie", "pedir", "otra vez"] },
  "Sad Pablo Escobar": { tags: ["esperando", "soledad", "aburrido"] },
  "Waiting Skeleton": { tags: ["esqueleto", "esperando", "eternidad"] },
  "Batman Slapping Robin": { tags: ["batman", "cachetada", "callate"] },
  "Success Kid": { tags: ["success kid", "exito", "logro"] },
  "Leonardo Dicaprio Cheers": { tags: ["dicaprio", "brindis", "salud"] },
  "Futurama Fry": { tags: ["fry", "sospecha", "no estoy seguro"] },
  "Grumpy Cat": { tags: ["gato grunon", "no"] },
  "Boardroom Meeting Suggestion": { tags: ["reunion de directorio", "sugerencia", "ventana", "boardroom"], categories: ["reuniones", "jefes"] },
  "Monkey Puppet": { tags: ["mono", "mirar al costado", "incomodo"] },
  "Panik Kalm Panik": { tags: ["panico", "calma", "panik kalm"] },
  "Epic Handshake": { tags: ["apreton de manos", "acuerdo", "en comun"] },
  "They're The Same Picture": { tags: ["the office", "pam", "son la misma foto"], categories: ["series-peliculas"] },
  "Tuxedo Winnie The Pooh": { tags: ["winnie pooh", "elegante", "fancy"] },
  "UNO Draw 25 Cards": { tags: ["uno", "25 cartas", "antes muerto"] },
  "Anakin Padme 4 Panel": { tags: ["anakin", "padme", "verdad"] },
  "Running Away Balloon": { tags: ["globo", "huir"] },
  "Always Has Been": { tags: ["always has been", "siempre fue", "astronauta"] },
  "Buff Doge vs. Cheems": { tags: ["doge", "cheems", "antes y ahora"] },
  "Sleeping Shaq": { tags: ["shaq", "dormido", "despierto"] },
  "Laughing Leo": { tags: ["leo", "risa"] },
};

type ImgflipResponse = { success: boolean; data: { memes: { id: string; name: string; url: string; width: number; height: number }[] } };

/** Imgflip's public API: the ~100 most used reaction templates (blank, ready to reuse). */
export const imgflipAdapter: Adapter = {
  id: "imgflip",
  label: "Imgflip (plantillas populares)",
  description: "API pública de Imgflip: las plantillas de reacción más usadas.",
  async fetch({ http, limit }) {
    const res = await http.json<ImgflipResponse>("https://api.imgflip.com/get_memes", { ignoreRobots: true });
    if (!res.success) throw new Error("Imgflip respondió success=false");
    const candidates: Candidate[] = res.data.memes.slice(0, Math.max(limit, 100)).map((m) => {
      const known = KNOWN[m.name];
      return {
        externalId: m.id,
        imageUrl: m.url,
        pageUrl: `https://imgflip.com/memegenerator/${m.id}`,
        title: `${m.name} (plantilla)`,
        description: `Plantilla de reacción “${m.name}”, sin texto, lista para usar.`,
        altText: `Plantilla del meme ${m.name}`,
        sourceName: "Imgflip",
        languages: [],
        tags: ["plantilla", "template", ...(known?.tags ?? [])],
        categories: ["reacciones", ...(known?.categories ?? [])],
        topical: true,
        license: "fair-use",
      };
    });
    return { candidates };
  },
};

const titleCase = (s: string) => s.replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());

type Cursor = { page?: number };

type TemplateHit = { id: string; name: string; key: string };

/** One page of Imgflip's template search: template id, name and image key (`abc123.jpg`). */
async function searchTemplates(http: AdapterContext["http"], q: string, page: number): Promise<TemplateHit[]> {
  const html = await http.text(`https://imgflip.com/memesearch?q=${encodeURIComponent(q)}&page=${page}`, { kind: "page" });
  const $ = cheerio.load(html);
  const hits: TemplateHit[] = [];
  $(".mt-box").each((_, el) => {
    const link = $(el).find(".mt-title a").first().attr("href") ?? "";
    const name = $(el).find(".mt-title a").first().text().trim();
    const thumb = $(el).find("img").first().attr("src") ?? "";
    const id = link.match(/\/meme\/(\d+)/)?.[1];
    // Thumbnails live at /4/<key>.jpg; the full template is /<key>.jpg (or .png).
    const key = thumb.match(/i\.imgflip\.com\/(?:\d+\/)?([a-z0-9]+\.(?:jpe?g|png))$/i)?.[1];
    if (id && key && name) hits.push({ id, name, key });
  });
  return hits;
}

/** Candidate fields shared by every template found through the search. */
const templateCandidate = (hit: TemplateHit) => ({
  externalId: hit.id,
  imageUrl: `https://i.imgflip.com/${hit.key}`,
  // Thumbnails are always .jpg; the original may be a .png.
  imageUrlFallbacks: [`https://i.imgflip.com/${hit.key.replace(/\.\w+$/, ".png")}`],
  pageUrl: `https://imgflip.com/meme/${hit.id}`,
  sourceName: "Imgflip",
  // Blank templates fit any language; detecting one would only read our own Spanish description.
  languages: [],
  topical: true,
  license: "fair-use",
});

const cleanName = (name: string) => titleCase(name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim());

/** `config.franchises`: ids from FRANCHISES, full Franchise objects for shows not in the list, or omitted for all. */
function franchisesFrom(config: Record<string, unknown>): Franchise[] {
  if (!Array.isArray(config.franchises)) return FRANCHISES;
  return config.franchises
    .map((f) => (typeof f === "string" ? franchiseById(f) : (f as Franchise)))
    .filter((f): f is Franchise => !!f?.name && !!f.imgflip);
}

/**
 * Imgflip's template search (public pages allowed by its robots.txt, fetched at page speed).
 * For each workplace show (see FRANCHISES) it finds the reaction templates — real frames from the
 * show, which is what people actually send. Captioned user memes are skipped on purpose: their
 * quality varies too much.
 * config: { franchises: ["the-office", ...], perQuery: 20, trustedTop: 15, maxPages: 3 }
 */
export const imgflipSearchAdapter: Adapter = {
  id: "imgflip-search",
  label: "Imgflip (plantillas de series)",
  description: "Plantillas de Imgflip de series y películas de oficina, buscadas por nombre y personajes.",
  missing(config) {
    return franchisesFrom(config).length ? null : "Configurá al menos una serie.";
  },
  describe(config) {
    return franchisesFrom(config).map((f) => `${f.name}: ${[...f.imgflip.trusted, ...f.imgflip.queries].join(", ")}`);
  },
  async fetch({ http, config, cursor, log }) {
    const perQuery = Number(config.perQuery ?? 20);
    const trustedTop = Number(config.trustedTop ?? 15);
    const maxPages = Number(config.maxPages ?? 3);
    const page = (((cursor as Cursor | null)?.page ?? 0) % maxPages) + 1;

    const candidates: Candidate[] = [];
    const seen = new Set<string>();
    let requests = 0;
    let failures = 0;
    for (const f of franchisesFrom(config)) {
      const mustMatch = f.imgflip.mustMatch.map((t) => t.toLowerCase());
      const exclude = (f.imgflip.exclude ?? []).map((t) => t.toLowerCase());
      const searches = [
        ...f.imgflip.trusted.map((q) => ({ q, trusted: true })),
        ...f.imgflip.queries.map((q) => ({ q, trusted: false })),
      ];
      for (const { q, trusted } of searches) {
        requests++;
        try {
          let taken = 0;
          for (const hit of await searchTemplates(http, q, page)) {
            if (taken >= (trusted ? trustedTop : perQuery)) break;
            if (seen.has(hit.id)) continue;
            const lower = hit.name.toLowerCase();
            // Show-name searches return the show's templates even when their names don't say so
            // ("Straight to Jail"); character searches must name the show or a character.
            if (!trusted && !mustMatch.some((t) => lower.includes(t))) continue;
            if (exclude.some((t) => lower.includes(t))) continue;
            seen.add(hit.id);
            taken++;
            const title = cleanName(hit.name);
            const named = f.names.some((n) => lower.includes(n));
            candidates.push({
              ...templateCandidate(hit),
              title: named ? title : `${title} (${f.name})`,
              description: `Plantilla de reacción “${title}” de ${f.name}.`,
              altText: `Escena de ${f.name}: ${title}`,
              tags: [...franchiseTagList(f), "plantilla", "template", q],
              categories: ["series-peliculas", "reacciones"],
            });
          }
        } catch (err) {
          failures++;
          log(`Imgflip “${q}”: ${(err as Error).message}`);
        }
      }
    }
    if (failures && failures === requests) throw new Error("Fallaron todas las búsquedas de Imgflip");
    return { candidates, cursor: { page } };
  },
};

/** `config.topics`: category slugs to search (default: every topic in TOPIC_SEARCHES). */
function topicsFrom(config: Record<string, unknown>): TopicSearch[] {
  if (!Array.isArray(config.topics)) return TOPIC_SEARCHES;
  return TOPIC_SEARCHES.filter((t) => (config.topics as unknown[]).includes(t.category));
}

/**
 * Imgflip's template search by workplace topic (see TOPIC_SEARCHES): the classic templates for each
 * category, e.g. "Boardroom Meeting Suggestion" for meetings. Takes the `perQuery` most popular
 * templates whose name mentions the topic.
 * config: { topics: ["reuniones", ...], perQuery: 6, maxPages: 2 }
 */
export const imgflipTopicsAdapter: Adapter = {
  id: "imgflip-topics",
  label: "Imgflip (plantillas por tema)",
  description: "Plantillas de Imgflip sobre temas de oficina (reuniones, jefes, lunes, sueldo…), una categoría por búsqueda.",
  missing(config) {
    return topicsFrom(config).length ? null : "Configurá al menos un tema.";
  },
  describe(config) {
    return topicsFrom(config).map((t) => `${categoryLabel(t.category)}: ${t.queries.join(", ")}`);
  },
  async fetch({ http, config, cursor, log }) {
    const perQuery = Number(config.perQuery ?? 6);
    const maxPages = Number(config.maxPages ?? 2);
    const page = (((cursor as Cursor | null)?.page ?? 0) % maxPages) + 1;

    const candidates: Candidate[] = [];
    const seen = new Set<string>();
    // Popular topics have dozens of uploads of the same template under the same name ("Payday"); keep the most used one.
    const seenNames = new Set<string>();
    let requests = 0;
    let failures = 0;
    for (const topic of topicsFrom(config)) {
      const label = categoryLabel(topic.category);
      for (const q of topic.queries) {
        requests++;
        try {
          let taken = 0;
          for (const hit of await searchTemplates(http, q, page)) {
            if (taken >= perQuery) break;
            const lower = hit.name.toLowerCase();
            const name = normalize(hit.name);
            if (seen.has(hit.id) || seenNames.has(name)) continue;
            if (!topic.mustMatch.some((t) => lower.includes(t)) || topic.exclude?.some((t) => lower.includes(t))) continue;
            seen.add(hit.id);
            seenNames.add(name);
            taken++;
            const title = cleanName(hit.name);
            candidates.push({
              ...templateCandidate(hit),
              title,
              description: `Plantilla de reacción “${title}” (${label.toLowerCase()}).`,
              altText: `Plantilla del meme ${title}`,
              tags: [...topic.tags, "plantilla", "template", q],
              categories: [topic.category, "reacciones"],
            });
          }
        } catch (err) {
          failures++;
          log(`Imgflip “${q}”: ${(err as Error).message}`);
        }
      }
    }
    if (failures && failures === requests) throw new Error("Fallaron todas las búsquedas de Imgflip");
    return { candidates, cursor: { page } };
  },
};
