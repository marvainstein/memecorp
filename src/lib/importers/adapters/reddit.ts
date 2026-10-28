import { config as appConfig } from "../../config";
import { isWorkRelated } from "../autotag";
import { isImageUrl, strings, type Adapter, type Candidate } from "../types";
import type { PoliteHttp } from "../http";

type RedditPost = {
  name: string;
  title: string;
  url: string;
  permalink: string;
  over_18: boolean;
  is_video: boolean;
  is_gallery?: boolean;
  author: string;
  score: number;
  subreddit: string;
  selftext?: string;
};

let token: { value: string; expires: number } | null = null;

/** App-only OAuth token (client_credentials) for Reddit's official Data API. */
async function accessToken(http: PoliteHttp) {
  if (token && token.expires > Date.now() + 60_000) return token.value;
  const { clientId, clientSecret } = appConfig.import.reddit;
  const res = await http.json<{ access_token: string; expires_in: number }>("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    ignoreRobots: true,
    retries: 1,
  });
  token = { value: res.access_token, expires: Date.now() + res.expires_in * 1000 };
  return token.value;
}

type Cursor = { after?: Record<string, string | null> };

/**
 * Reddit through its official Data API (OAuth). Reddit forbids unauthenticated scraping, so this
 * adapter only runs with REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET (a free "script" app).
 * config: { subreddits: ["ProgrammerHumor"], queries: ["office meme"], topical: ["recruitinghell"], time: "week", minScore }
 */
export const redditAdapter: Adapter = {
  id: "reddit",
  label: "Reddit (API oficial)",
  description: "API oficial de Reddit con OAuth: subreddits y búsquedas.",
  missing(config) {
    if (!appConfig.import.reddit.clientId || !appConfig.import.reddit.clientSecret) return "Faltan REDDIT_CLIENT_ID y REDDIT_CLIENT_SECRET.";
    return strings(config.subreddits).length || strings(config.queries).length ? null : "Configurá subreddits o búsquedas.";
  },
  async fetch({ http, config, cursor, log }) {
    const auth = { Authorization: `Bearer ${await accessToken(http)}` };
    const time = String(config.time || "week");
    const minScore = Number(config.minScore ?? 100);
    const topical = new Set(strings(config.topical).map((s) => s.toLowerCase()));
    const after = { ...((cursor as Cursor | null)?.after ?? {}) };

    const listings = [
      ...strings(config.subreddits).map((s) => ({
        key: `r/${s}`,
        url: `https://oauth.reddit.com/r/${encodeURIComponent(s)}/top?t=${time}&limit=100`,
        query: undefined as string | undefined,
      })),
      ...strings(config.queries).map((q) => ({
        key: `q:${q}`,
        url: `https://oauth.reddit.com/search?q=${encodeURIComponent(q)}&type=link&sort=top&t=${time}&limit=100`,
        query: q,
      })),
    ];

    const candidates: Candidate[] = [];
    let failures = 0;
    for (const l of listings) {
      try {
        const url = after[l.key] ? `${l.url}&after=${after[l.key]}` : l.url;
        const data = await http.json<{ data: { after: string | null; children: { data: RedditPost }[] } }>(url, { headers: auth, ignoreRobots: true });
        after[l.key] = data.data.after; // next run continues where this one stopped
        for (const { data: p } of data.data.children) {
          if (p.over_18 || p.is_video || p.is_gallery || p.score < minScore) continue;
          if (!isImageUrl(p.url) || !/^https:\/\/(i\.redd\.it|i\.imgur\.com)\//.test(p.url)) continue;
          candidates.push({
            externalId: p.name,
            imageUrl: p.url,
            pageUrl: `https://www.reddit.com${p.permalink}`,
            title: p.title.slice(0, 160),
            description: (p.selftext ?? "").slice(0, 600),
            author: `u/${p.author}`,
            sourceName: `Reddit r/${p.subreddit}`,
            tags: l.query ? [l.query] : [],
            topical: topical.has(p.subreddit.toLowerCase()) || isWorkRelated(`${p.title} ${p.selftext ?? ""}`),
            score: p.score,
          });
        }
      } catch (err) {
        failures++;
        log(`${l.key}: ${(err as Error).message}`);
        if ((err as { status?: number }).status === 401) token = null;
      }
    }
    if (listings.length && failures === listings.length) throw new Error("Ninguna consulta a Reddit respondió");
    return { candidates, cursor: { after } };
  },
};
