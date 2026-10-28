import { config } from "../config";

/**
 * Polite HTTP client shared by every import adapter:
 * - per-host throttling (minimum gap between requests, raised by robots.txt Crawl-delay for page crawls),
 * - robots.txt Allow/Disallow checks,
 * - timeouts, a response size cap, and retries with exponential backoff that honor Retry-After.
 * The goal is to stay well inside each source's limits so we never get blocked in the first place.
 */

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export const ROBOTS_BLOCKED = "Blocked by robots.txt";

export type RequestKind = "api" | "page" | "image";

export type RequestOptions = {
  kind?: RequestKind;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
  body?: string | URLSearchParams;
  maxBytes?: number;
  retries?: number;
  timeoutMs?: number;
  /** Skip the robots.txt check (only for official, authenticated APIs whose terms we follow). */
  ignoreRobots?: boolean;
};

const DEFAULT_GAP_MS: Record<RequestKind, number> = { api: 1500, page: 5000, image: 400 };
const MAX_BACKOFF_MS = 60_000;
const ROBOTS_TTL_MS = 6 * 60 * 60 * 1000;

type RobotsRules = { allow: string[]; disallow: string[]; crawlDelayMs: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class PoliteHttp {
  private nextSlot = new Map<string, number>();
  private robots = new Map<string, { at: number; rules: RobotsRules | null }>();

  constructor(
    readonly userAgent = config.import.userAgent,
    private gaps: Partial<Record<string, number>> = {},
  ) {}

  /** Waits until this host may be contacted again, then reserves the next slot. */
  private async throttle(host: string, gapMs: number) {
    const now = Date.now();
    const at = Math.max(now, this.nextSlot.get(host) ?? 0);
    this.nextSlot.set(host, at + gapMs);
    if (at > now) await sleep(at - now);
  }

  private pushBack(host: string, ms: number) {
    this.nextSlot.set(host, Math.max(this.nextSlot.get(host) ?? 0, Date.now() + ms));
  }

  async robotsFor(origin: string): Promise<RobotsRules | null> {
    const cached = this.robots.get(origin);
    if (cached && Date.now() - cached.at < ROBOTS_TTL_MS) return cached.rules;
    let rules: RobotsRules | null = null;
    try {
      const res = await fetch(`${origin}/robots.txt`, {
        headers: { "User-Agent": this.userAgent },
        signal: AbortSignal.timeout(10_000),
        redirect: "follow",
      });
      if (res.ok) rules = parseRobots(await res.text(), this.userAgent);
      // 4xx: no robots.txt → everything allowed. 5xx: be conservative and treat the site as closed.
      else if (res.status >= 500) rules = { allow: [], disallow: ["/"], crawlDelayMs: 0 };
    } catch {
      rules = null;
    }
    this.robots.set(origin, { at: Date.now(), rules });
    return rules;
  }

  async allowed(url: string): Promise<{ ok: boolean; crawlDelayMs: number }> {
    const u = new URL(url);
    const rules = await this.robotsFor(u.origin);
    if (!rules) return { ok: true, crawlDelayMs: 0 };
    const path = u.pathname + u.search;
    const match = (list: string[]) => Math.max(-1, ...list.filter((p) => robotsMatch(p, path)).map((p) => p.length));
    return { ok: match(rules.allow) >= match(rules.disallow), crawlDelayMs: rules.crawlDelayMs };
  }

  async request(url: string, opts: RequestOptions = {}): Promise<{ status: number; headers: Headers; body: Buffer; url: string }> {
    const kind = opts.kind ?? "api";
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new HttpError("Unsupported protocol", 0, url, false);

    let gap = this.gaps[u.host] ?? DEFAULT_GAP_MS[kind];
    if (!opts.ignoreRobots) {
      const robots = await this.allowed(url);
      if (!robots.ok) throw new HttpError(ROBOTS_BLOCKED, 0, url, false);
      // Crawl-delay is meant for crawlers walking pages; API calls and image fetches keep their own gaps.
      if (kind === "page") gap = Math.max(gap, robots.crawlDelayMs);
    }

    const retries = opts.retries ?? 3;
    for (let attempt = 0; ; attempt++) {
      await this.throttle(u.host, gap);
      try {
        const res = await fetch(url, {
          method: opts.method ?? "GET",
          body: opts.body,
          redirect: "follow",
          headers: { "User-Agent": this.userAgent, Accept: kind === "image" ? "image/*" : "*/*", ...opts.headers },
          signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
        });
        if (res.status === 429 || res.status === 503 || res.status >= 500) {
          const wait = retryAfterMs(res.headers.get("retry-after")) ?? backoff(attempt);
          this.pushBack(u.host, wait);
          await res.body?.cancel();
          if (attempt < retries) {
            await sleep(wait);
            continue;
          }
          throw new HttpError(`HTTP ${res.status}`, res.status, url, true);
        }
        if (!res.ok) {
          await res.body?.cancel();
          throw new HttpError(`HTTP ${res.status}`, res.status, url, false);
        }
        const body = await readCapped(res, opts.maxBytes ?? 20 * 1024 * 1024, url);
        return { status: res.status, headers: res.headers, body, url: res.url };
      } catch (err) {
        if (err instanceof HttpError && !err.retryable) throw err;
        if (attempt >= retries) throw err instanceof HttpError ? err : new HttpError(String((err as Error).message), 0, url, true);
        await sleep(backoff(attempt));
      }
    }
  }

  async json<T>(url: string, opts: RequestOptions = {}): Promise<T> {
    const res = await this.request(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
    return JSON.parse(res.body.toString("utf8")) as T;
  }

  async text(url: string, opts: RequestOptions = {}): Promise<string> {
    return (await this.request(url, opts)).body.toString("utf8");
  }
}

const backoff = (attempt: number) => Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);

function retryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.min(MAX_BACKOFF_MS * 5, secs * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

async function readCapped(res: Response, maxBytes: number, url: string): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length"));
  if (declared && declared > maxBytes) {
    await res.body?.cancel();
    throw new HttpError("Response too large", res.status, url, false);
  }
  if (!res.body) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError("Response too large", res.status, url, false);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** robots.txt path pattern match with `*` wildcards and `$` end anchors. */
function robotsMatch(pattern: string, path: string): boolean {
  if (!pattern) return false;
  const anchored = pattern.endsWith("$");
  const source = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`).test(path);
}

export function parseRobots(txt: string, userAgent: string): RobotsRules {
  const token = userAgent.split("/")[0].toLowerCase();
  type Group = { agents: string[]; allow: string[]; disallow: string[]; delay: number };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [], delay: 0 };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow") current.allow.push(value);
    else if (key === "disallow" && value) current.disallow.push(value);
    else if (key === "crawl-delay") current.delay = Number(value) || 0;
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const chosen = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  return {
    allow: chosen.flatMap((g) => g.allow),
    disallow: chosen.flatMap((g) => g.disallow),
    crawlDelayMs: Math.max(0, ...chosen.map((g) => g.delay)) * 1000,
  };
}
