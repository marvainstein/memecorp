/**
 * Sources created on first run. Admins can enable/disable them, tweak their config and add
 * more from /admin/sources. Sources whose credentials are missing are skipped, not failed.
 */
export type SourceSeed = { id: string; adapter: string; name: string; intervalMinutes: number; enabled: boolean; config: Record<string, unknown> };

export const DEFAULT_SOURCES: SourceSeed[] = [
  {
    id: "imgflip-templates",
    adapter: "imgflip",
    name: "Imgflip — plantillas de reacción",
    intervalMinutes: 24 * 60,
    enabled: true,
    config: {},
  },
  {
    id: "lemmy-work-humor",
    adapter: "lemmy",
    name: "Lemmy — humor laboral",
    intervalMinutes: 3 * 60,
    enabled: true,
    config: {
      instance: "https://lemmy.world",
      // Posts must mention work/office topics (title or OCR); search results only count from meme communities.
      communities: ["programmer_humor@programming.dev", "memes@lemmy.world"],
      topical: [],
      defaults: {
        "programmer_humor@programming.dev": { tags: ["programacion", "developer"], categories: ["programacion"] },
      },
      queries: ["corporate", "office meme", "my boss", "my manager", "coworker", "work meme", "meeting email", "salary"],
      sort: "TopMonth",
      minScore: 30,
      maxPages: 5,
    },
  },
  {
    id: "imgflip-series",
    adapter: "imgflip-search",
    name: "Imgflip — plantillas de series de oficina",
    intervalMinutes: 24 * 60,
    enabled: true,
    // Every show in src/lib/memes/franchises.ts; list ids to narrow it, e.g. ["the-office", "parks-and-rec"].
    config: { perQuery: 20, trustedTop: 15, maxPages: 3 },
  },
  {
    id: "imgflip-topics",
    adapter: "imgflip-topics",
    name: "Imgflip — plantillas por tema",
    intervalMinutes: 24 * 60,
    enabled: true,
    // Every topic in src/lib/memes/topics.ts; list category slugs to narrow it, e.g. ["reuniones", "jefes"].
    config: { perQuery: 6, maxPages: 2 },
  },
  {
    id: "lemmy-series",
    adapter: "lemmy",
    name: "Lemmy — fans de series de oficina",
    intervalMinutes: 12 * 60,
    enabled: true,
    config: {
      instance: "https://lemmy.world",
      communities: [
        "dundermifflin@piefed.jeena.net", "dundermifflin@lemmy.ml", "dundermifflin@lemm.ee", "severance@lemmy.world", "itcrowd@lemmy.world",
      ],
      topical: [
        "dundermifflin@piefed.jeena.net", "dundermifflin@lemmy.ml", "dundermifflin@lemm.ee", "severance@lemmy.world", "itcrowd@lemmy.world",
      ],
      defaults: {
        "dundermifflin@piefed.jeena.net": { tags: ["the office", "dunder mifflin", "la oficina"], categories: ["series-peliculas"] },
        "dundermifflin@lemmy.ml": { tags: ["the office", "dunder mifflin", "la oficina"], categories: ["series-peliculas"] },
        "dundermifflin@lemm.ee": { tags: ["the office", "dunder mifflin", "la oficina"], categories: ["series-peliculas"] },
        "severance@lemmy.world": { tags: ["severance", "lumon"], categories: ["series-peliculas"] },
        "itcrowd@lemmy.world": { tags: ["the it crowd", "it crowd"], categories: ["series-peliculas"] },
      },
      // Searched across all of Lemmy; results must mention the show (title, caption or OCR).
      queries: [
        "the office", "dunder mifflin", "michael scott", "dwight schrute", "parks and rec", "ron swanson", "leslie knope",
        "nathan fielder", "nathan for you", "severance", "lumon", "silicon valley", "gilfoyle", "it crowd", "office space",
        "lumbergh", "brooklyn 99", "succession", "mad men",
      ],
      showQueries: true,
      sort: "TopAll",
      minScore: 25,
      maxPages: 3,
    },
  },
  {
    id: "reddit-work-humor",
    adapter: "reddit",
    name: "Reddit — humor corporativo (API oficial)",
    intervalMinutes: 6 * 60,
    enabled: true,
    config: {
      subreddits: ["ProgrammerHumor", "recruitinghell", "antiwork", "DunderMifflin", "sysadmin"],
      topical: ["ProgrammerHumor", "recruitinghell", "antiwork", "DunderMifflin", "sysadmin"],
      queries: ["corporate meme", "office meme", "work meme", "meeting meme", "memes trabajo", "memes oficina"],
      time: "week",
      minScore: 100,
    },
  },
  {
    id: "pinterest-boards",
    adapter: "pinterest",
    name: "Pinterest — tableros (API oficial)",
    intervalMinutes: 12 * 60,
    enabled: true,
    config: { boards: [], queries: ["corporate meme", "corporate meme the office", "corporate meme happy"] },
  },
  {
    id: "rss-feeds",
    adapter: "feed",
    name: "Feeds RSS / Atom",
    intervalMinutes: 6 * 60,
    enabled: false,
    config: { feeds: [], topical: false },
  },
  {
    id: "web-pages",
    adapter: "webpage",
    name: "Páginas web permitidas",
    intervalMinutes: 24 * 60,
    enabled: false,
    config: { pages: [], selector: "img", minWidth: 300, topical: false },
  },
];
