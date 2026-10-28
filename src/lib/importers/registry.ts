import { imgflipAdapter, imgflipSearchAdapter } from "./adapters/imgflip";
import { lemmyAdapter } from "./adapters/lemmy";
import { pinterestAdapter } from "./adapters/pinterest";
import { redditAdapter } from "./adapters/reddit";
import { feedAdapter, webpageAdapter } from "./adapters/web";
import type { Adapter } from "./types";

export const ADAPTERS: Record<string, Adapter> = Object.fromEntries(
  [imgflipAdapter, imgflipSearchAdapter, lemmyAdapter, redditAdapter, pinterestAdapter, feedAdapter, webpageAdapter].map((a) => [a.id, a]),
);
