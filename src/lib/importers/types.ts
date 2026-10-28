import type { PoliteHttp } from "./http";

/** One image found by an adapter, before it is downloaded and indexed. */
export type Candidate = {
  /** Stable id inside the source (used to never process the same item twice). */
  externalId: string;
  imageUrl: string;
  /** Tried in order when imageUrl answers 404 (e.g. the same image under another extension). */
  imageUrlFallbacks?: string[];
  /** Public page of the original post: stored as the meme's source URL (provenance). */
  pageUrl: string;
  title: string;
  description?: string;
  altText?: string;
  author?: string;
  /** Human label, e.g. "Reddit r/ProgrammerHumor". */
  sourceName: string;
  tags?: string[];
  categories?: string[];
  languages?: string[];
  /** Already known to be about work/office humor (e.g. it came from a work-humor community or query). */
  topical?: boolean;
  /** Only import it if its text (title, caption or OCR) mentions one of the workplace shows. */
  requireFranchise?: boolean;
  nsfw?: boolean;
  score?: number;
  license?: string;
};

export type AdapterContext = {
  http: PoliteHttp;
  config: Record<string, unknown>;
  /** Adapter-defined state persisted between runs (pagination position, etc.). */
  cursor: unknown;
  limit: number;
  log: (message: string) => void;
};

export type AdapterResult = { candidates: Candidate[]; cursor?: unknown };

export interface Adapter {
  id: string;
  label: string;
  description: string;
  /** Returns a human-readable reason when the adapter cannot run (missing credentials or config). */
  missing?(config: Record<string, unknown>): string | null;
  fetch(ctx: AdapterContext): Promise<AdapterResult>;
}

export const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
export const isImageUrl = (url: string | null | undefined) => !!url && /\.(jpe?g|png|webp)(\?|$)/i.test(url);
