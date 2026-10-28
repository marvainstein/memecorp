import { config as appConfig } from "../../config";
import { isWorkRelated } from "../autotag";
import { strings, type Adapter, type Candidate } from "../types";

type Pin = {
  id: string;
  title?: string | null;
  description?: string | null;
  alt_text?: string | null;
  link?: string | null;
  media?: { media_type?: string; images?: Record<string, { url: string; width: number; height: number }> };
};

type Cursor = { bookmarks?: Record<string, string | null> };

const API = "https://api.pinterest.com/v5";

function bestImage(pin: Pin) {
  const images = pin.media?.images ?? {};
  return images.originals ?? images["1200x"] ?? images["600x"] ?? Object.values(images).sort((a, b) => b.width - a.width)[0];
}

/**
 * Pinterest through the official API v5 (PINTEREST_ACCESS_TOKEN). The API does not offer open
 * public search to most apps, so this reads the boards your token can access (for example a
 * board where you save "corporate meme" pins) and, optionally, searches your own pins.
 * config: { boards: ["<board_id>"], queries: ["corporate meme"] }
 */
export const pinterestAdapter: Adapter = {
  id: "pinterest",
  label: "Pinterest (API oficial v5)",
  description: "Tableros accesibles con tu token de la API oficial de Pinterest.",
  missing(config) {
    if (!appConfig.import.pinterestToken) return "Falta PINTEREST_ACCESS_TOKEN.";
    return strings(config.boards).length || strings(config.queries).length ? null : "Configurá al menos un tablero (board id).";
  },
  async fetch({ http, config, cursor, log }) {
    const headers = { Authorization: `Bearer ${appConfig.import.pinterestToken}` };
    const bookmarks = { ...((cursor as Cursor | null)?.bookmarks ?? {}) };
    const lists = [
      ...strings(config.boards).map((b) => ({ key: `board:${b}`, url: `${API}/boards/${encodeURIComponent(b)}/pins?page_size=100`, onTopic: true })),
      ...strings(config.queries).map((q) => ({ key: `q:${q}`, url: `${API}/search/pins?query=${encodeURIComponent(q)}`, onTopic: false })),
    ];

    const candidates: Candidate[] = [];
    let failures = 0;
    for (const l of lists) {
      try {
        const url = bookmarks[l.key] ? `${l.url}&bookmark=${encodeURIComponent(bookmarks[l.key]!)}` : l.url;
        const data = await http.json<{ items: Pin[]; bookmark?: string | null }>(url, { headers, ignoreRobots: true });
        bookmarks[l.key] = data.bookmark ?? null;
        for (const pin of data.items ?? []) {
          if (pin.media?.media_type && pin.media.media_type !== "image") continue;
          const img = bestImage(pin);
          if (!img || /\.gif(\?|$)/i.test(img.url)) continue;
          const title = (pin.title || pin.alt_text || pin.description || "Meme de Pinterest").slice(0, 160);
          candidates.push({
            externalId: pin.id,
            imageUrl: img.url,
            pageUrl: `https://www.pinterest.com/pin/${pin.id}/`,
            title,
            description: pin.description ?? undefined,
            altText: pin.alt_text ?? undefined,
            sourceName: "Pinterest",
            topical: l.onTopic || isWorkRelated(`${title} ${pin.description ?? ""}`),
          });
        }
      } catch (err) {
        failures++;
        log(`${l.key}: ${(err as Error).message}`);
      }
    }
    if (lists.length && failures === lists.length) throw new Error("Ninguna consulta a Pinterest respondió");
    return { candidates, cursor: { bookmarks } };
  },
};
