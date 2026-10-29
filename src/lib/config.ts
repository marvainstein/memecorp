import path from "node:path";

const bool = (value: string | undefined, fallback: boolean) =>
  value == null || value === "" ? fallback : /^(1|true|yes|on|si|sí)$/i.test(value);

const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && value !== "" && value != null ? n : fallback;
};

/** Vercel functions: read-only filesystem (except /tmp) and no long-running process. */
const onVercel = Boolean(process.env.VERCEL);

export const config = {
  databaseUrl: process.env.DATABASE_URL?.trim() || "",
  dataDir: path.resolve(process.env.DATA_DIR || (onVercel ? "/tmp/memedesk" : "data")),
  storage: {
    // A configured bucket implies S3, so a forgotten STORAGE_DRIVER doesn't silently fall back to local disk.
    driver: (process.env.STORAGE_DRIVER || (process.env.S3_BUCKET ? "s3" : "local")) as "local" | "s3",
    bucket: process.env.S3_BUCKET || "",
    region: process.env.S3_REGION || "auto",
    // "s3.us-east-005.backblazeb2.com" (as providers often show it) needs a scheme for the SDK.
    endpoint: (process.env.S3_ENDPOINT?.trim() || undefined)?.replace(/^(?!https?:\/\/)/, "https://"),
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    publicUrl: (process.env.S3_PUBLIC_URL || "").replace(/\/+$/, ""),
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, true),
  },
  import: {
    /** "inprocess" runs the scheduler inside the Next server; "off" leaves it to `npm run worker` / cron. */
    scheduler: (process.env.IMPORT_SCHEDULER || (onVercel ? "off" : "inprocess")) as "inprocess" | "off",
    /** Publish imported memes immediately; false sends them to the review queue (status pending). */
    autoPublish: bool(process.env.IMPORT_AUTO_PUBLISH, true),
    userAgent: process.env.IMPORT_USER_AGENT || "MemeDeskBot/1.0 (+https://github.com/marvainstein/memecorp)",
    maxPerRun: num(process.env.IMPORT_MAX_PER_RUN, 60),
    /** Read the text printed on each imported meme (tesseract.js) so it becomes searchable. */
    ocr: bool(process.env.IMPORT_OCR, true),
    /** Extra comma-separated words that make the importer skip a post (title, description or OCR text). */
    blocklist: (process.env.IMPORT_BLOCKLIST || "").split(",").map((w) => w.trim().toLowerCase()).filter(Boolean),
    cronSecret: process.env.CRON_SECRET || "",
    reddit: { clientId: process.env.REDDIT_CLIENT_ID || "", clientSecret: process.env.REDDIT_CLIENT_SECRET || "" },
    pinterestToken: process.env.PINTEREST_ACCESS_TOKEN || "",
  },
  reportAutohideThreshold: num(process.env.REPORT_AUTOHIDE_THRESHOLD, 3),
  maxUploadBytes: num(process.env.MAX_UPLOAD_MB, 15) * 1024 * 1024,
  siteUrl: (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ).replace(/\/+$/, ""),
};
