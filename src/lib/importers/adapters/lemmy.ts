import { isWorkRelated } from "../autotag";
import { isImageUrl, strings, type Adapter, type Candidate } from "../types";

type LemmyPost = {
  post: { id: number; name: string; url?: string; body?: string; ap_id: string; nsfw: boolean; url_content_type?: string; alt_text?: string };
  community: { name: string; actor_id: string; nsfw?: boolean };
  creator: { name: string };
  counts: { score: number };
};

type Cursor = { page?: number };

/**
 * Lemmy (federated, open API, no key needed). Reads communities and/or search queries.
 * config: { instance, communities: ["memes@lemmy.world"], queries: ["corporate"], topical: ["workreform@lemmy.world"], sort, minScore, maxPages }
 */
export const lemmyAdapter: Adapter = {
  id: "lemmy",
  label: "Lemmy (comunidades federadas)",
  description: "API abierta de Lemmy: comunidades y búsquedas de memes.",
  missing(config) {
    return strings(config.communities).length || strings(config.queries).length ? null : "Configurá al menos una comunidad o búsqueda.";
  },
  async fetch({ http, config, cursor, log }) {
    const instance = String(config.instance || "https://lemmy.world").replace(/\/+$/, "");
    const sort = String(config.sort || "TopMonth");
    const minScore = Number(config.minScore ?? 20);
    const maxPages = Number(config.maxPages ?? 5);
    const topical = new Set(strings(config.topical).map((c) => c.toLowerCase()));
    const defaults = (config.defaults ?? {}) as Record<string, { tags?: string[]; categories?: string[] }>;
    // Walk one page deeper each run so the catalog keeps growing, then start over.
    const page = (((cursor as Cursor | null)?.page ?? 0) % maxPages) + 1;

    const requests: { url: string; label: string; onTopic: boolean; query?: string; community?: string }[] = [
      ...strings(config.communities).map((c) => ({
        url: `${instance}/api/v3/post/list?community_name=${encodeURIComponent(c)}&sort=${sort}&limit=50&page=${page}`,
        label: c,
        onTopic: topical.has(c.toLowerCase()),
        community: c,
      })),
      ...strings(config.queries).map((q) => ({
        url: `${instance}/api/v3/search?q=${encodeURIComponent(q)}&type_=Posts&sort=${sort}&limit=50&page=${page}`,
        label: `búsqueda “${q}”`,
        onTopic: false,
        query: q,
        community: undefined as string | undefined,
      })),
    ];

    const candidates: Candidate[] = [];
    let failures = 0;
    for (const req of requests) {
      try {
        const data = await http.json<{ posts: LemmyPost[] }>(req.url, { kind: "api" });
        for (const p of data.posts ?? []) {
          const url = p.post.url;
          if (!url || !(isImageUrl(url) || p.post.url_content_type?.startsWith("image/"))) continue;
          if (/\.gif(\?|$)/i.test(url) || p.post.url_content_type === "image/gif") continue;
          if (p.post.nsfw || p.community.nsfw || p.counts.score < minScore) continue;
          const text = `${p.post.name} ${p.post.body ?? ""} ${p.post.alt_text ?? ""}`;
          candidates.push({
            externalId: p.post.ap_id,
            imageUrl: url,
            pageUrl: p.post.ap_id,
            title: p.post.name.slice(0, 160),
            description: (p.post.body ?? "").slice(0, 600),
            altText: p.post.alt_text,
            author: p.creator.name,
            sourceName: `Lemmy ${p.community.name}`,
            tags: [...(req.query ? [req.query] : []), ...(defaults[req.community ?? ""]?.tags ?? [])],
            categories: defaults[req.community ?? ""]?.categories,
            topical: req.onTopic || isWorkRelated(text),
            score: p.counts.score,
          });
        }
      } catch (err) {
        failures++;
        log(`${req.label}: ${(err as Error).message}`);
      }
    }
    if (failures === requests.length) throw new Error("Ninguna consulta a Lemmy respondió");
    return { candidates, cursor: { page } };
  },
};
