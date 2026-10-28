import * as cheerio from "cheerio";
import { FRANCHISES, franchiseById, franchiseTagList, type Franchise } from "../../memes/franchises";
import type { Adapter, Candidate } from "../types";

/** Hand-tagged emotions/tags for well-known reaction templates (by Imgflip template name). */
const KNOWN: Record<string, { tags: string[]; emotions: string[]; categories?: string[] }> = {
  "Drake Hotline Bling": { tags: ["drake", "preferencia", "prefer", "esto no esto si"], emotions: ["relatable"] },
  "Two Buttons": { tags: ["dos botones", "decision", "dilema", "sweating"], emotions: ["overwhelmed", "awkward"] },
  "Distracted Boyfriend": { tags: ["novio distraido", "tentacion", "distracted"], emotions: ["relatable"] },
  "This Is Fine": { tags: ["this is fine", "todo bien", "incendio", "perro"], emotions: ["chaos", "unbothered"] },
  "Disaster Girl": { tags: ["disaster girl", "incendio", "nena"], emotions: ["chaos", "sarcastic"] },
  "Roll Safe Think About It": { tags: ["think about it", "pensalo", "logica"], emotions: ["sarcastic"] },
  "Hide the Pain Harold": { tags: ["harold", "dolor", "sonrisa falsa", "stock photo"], emotions: ["fake-enthusiasm", "dead-inside"] },
  "Woman Yelling At Cat": { tags: ["gato", "gritando", "discusion"], emotions: ["angry", "confused"] },
  "Surprised Pikachu": { tags: ["pikachu", "sorpresa", "obvio"], emotions: ["shocked", "sarcastic"] },
  "Change My Mind": { tags: ["change my mind", "opinion", "debate"], emotions: ["sarcastic"] },
  "Mocking Spongebob": { tags: ["bob esponja", "burla", "spongebob"], emotions: ["sarcastic", "passive-aggressive"] },
  "Left Exit 12 Off Ramp": { tags: ["salida", "volantazo", "decision"], emotions: ["chaos"] },
  "Gru's Plan": { tags: ["gru", "plan", "plan fallido"], emotions: ["confused", "shocked"] },
  "Is This A Pigeon": { tags: ["paloma", "pigeon", "confusion"], emotions: ["confused"] },
  "Expanding Brain": { tags: ["cerebro", "galaxy brain", "niveles"], emotions: ["sarcastic"] },
  "Bernie I Am Once Again Asking For Your Support": { tags: ["bernie", "pedir", "otra vez"], emotions: ["tired"] },
  "Sad Pablo Escobar": { tags: ["esperando", "soledad", "aburrido"], emotions: ["sad", "tired"] },
  "Waiting Skeleton": { tags: ["esqueleto", "esperando", "eternidad"], emotions: ["tired", "dead-inside"] },
  "Batman Slapping Robin": { tags: ["batman", "cachetada", "callate"], emotions: ["angry"] },
  "Success Kid": { tags: ["success kid", "exito", "logro"], emotions: ["celebrating", "happy"] },
  "Leonardo Dicaprio Cheers": { tags: ["dicaprio", "brindis", "salud"], emotions: ["celebrating"] },
  "Futurama Fry": { tags: ["fry", "sospecha", "no estoy seguro"], emotions: ["confused"] },
  "Grumpy Cat": { tags: ["gato grunon", "no"], emotions: ["angry", "unbothered"] },
  "Boardroom Meeting Suggestion": { tags: ["reunion de directorio", "sugerencia", "ventana", "boardroom"], emotions: ["angry"], categories: ["reuniones", "jefes"] },
  "Monkey Puppet": { tags: ["mono", "mirar al costado", "incomodo"], emotions: ["awkward"] },
  "Panik Kalm Panik": { tags: ["panico", "calma", "panik kalm"], emotions: ["overwhelmed", "chaos"] },
  "Epic Handshake": { tags: ["apreton de manos", "acuerdo", "en comun"], emotions: ["relatable"] },
  "They're The Same Picture": { tags: ["the office", "pam", "son la misma foto"], emotions: ["confused", "sarcastic"], categories: ["series-peliculas"] },
  "Tuxedo Winnie The Pooh": { tags: ["winnie pooh", "elegante", "fancy"], emotions: ["sarcastic"] },
  "UNO Draw 25 Cards": { tags: ["uno", "25 cartas", "antes muerto"], emotions: ["unbothered", "sarcastic"] },
  "Anakin Padme 4 Panel": { tags: ["anakin", "padme", "verdad"], emotions: ["awkward", "shocked"] },
  "Running Away Balloon": { tags: ["globo", "huir"], emotions: ["sad"] },
  "Always Has Been": { tags: ["always has been", "siempre fue", "astronauta"], emotions: ["shocked"] },
  "Buff Doge vs. Cheems": { tags: ["doge", "cheems", "antes y ahora"], emotions: ["sarcastic"] },
  "Sleeping Shaq": { tags: ["shaq", "dormido", "despierto"], emotions: ["tired"] },
  "Laughing Leo": { tags: ["leo", "risa"], emotions: ["happy", "sarcastic"] },
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
        tags: ["plantilla", "template", ...(known?.tags ?? [])],
        emotions: known?.emotions ?? [],
        categories: ["reacciones", ...(known?.categories ?? [])],
        topical: true,
        license: "fair-use",
      };
    });
    return { candidates };
  },
};

/** Words in a template name that hint at the reaction it is used for. */
const EMOTION_HINTS: [RegExp, string[]][] = [
  [/\bno+\b.*\bgod\b|\bnoo+\b|\bno god\b/i, ["shocked", "angry"]],
  [/congratulat|celebrat|party|cheers/i, ["celebrating", "sarcastic"]],
  [/bankrupt|panic|chaos|fire|burn/i, ["chaos"]],
  [/happening|excit|ready|yes+\b/i, ["excited"]],
  [/\bcry|crying|sad|tears/i, ["sad"]],
  [/annoy|angry|mad\b|furious|stare/i, ["angry", "passive-aggressive"]],
  [/handshake|awkward|camera|look|smirk/i, ["awkward", "sarcastic"]],
  [/same picture|confus|what\b|huh/i, ["confused"]],
  [/\bfalse\b|\bfact\b|\bquestion\b|explain|whiteboard/i, ["sarcastic"]],
  [/tired|sleep|bored/i, ["tired"]],
  [/thank|happy|smil|laugh/i, ["happy"]],
];

const titleCase = (s: string) => s.replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());

type Cursor = { page?: number };

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
          const html = await http.text(`https://imgflip.com/memesearch?q=${encodeURIComponent(q)}&page=${page}`, { kind: "page" });
          const $ = cheerio.load(html);
          let taken = 0;
          $(".mt-box").each((_, el) => {
            if (taken >= (trusted ? trustedTop : perQuery)) return false;
            const link = $(el).find(".mt-title a").first().attr("href") ?? "";
            const name = $(el).find(".mt-title a").first().text().trim();
            const thumb = $(el).find("img").first().attr("src") ?? "";
            const id = link.match(/\/meme\/(\d+)/)?.[1];
            // Thumbnails live at /4/<key>.jpg; the full template is /<key>.jpg (or .png).
            const key = thumb.match(/i\.imgflip\.com\/(?:\d+\/)?([a-z0-9]+\.(?:jpe?g|png))$/i)?.[1];
            if (!id || !key || !name || seen.has(id)) return;
            const lower = name.toLowerCase();
            // Show-name searches return the show's templates even when their names don't say so
            // ("Straight to Jail"); character searches must name the show or a character.
            if (!trusted && !mustMatch.some((t) => lower.includes(t))) return;
            if (exclude.some((t) => lower.includes(t))) return;
            seen.add(id);
            taken++;
            const emotions = [...new Set(EMOTION_HINTS.filter(([re]) => re.test(name)).flatMap(([, e]) => e))];
            const title = titleCase(name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim());
            const named = f.names.some((n) => lower.includes(n));
            candidates.push({
              externalId: id,
              imageUrl: `https://i.imgflip.com/${key}`,
              // Thumbnails are always .jpg; the original may be a .png.
              imageUrlFallbacks: [`https://i.imgflip.com/${key.replace(/\.\w+$/, ".png")}`],
              pageUrl: `https://imgflip.com/meme/${id}`,
              title: named ? title : `${title} (${f.name})`,
              description: `Plantilla de reacción “${title}” de ${f.name}.`,
              altText: `Escena de ${f.name}: ${title}`,
              sourceName: "Imgflip",
              tags: [...franchiseTagList(f), "plantilla", "template", q],
              emotions,
              categories: ["series-peliculas", "reacciones"],
              topical: true,
              license: "fair-use",
            });
          });
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
