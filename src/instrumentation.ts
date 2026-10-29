/** Starts the automatic import scheduler inside the Next.js server (Node.js runtime only). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Serverless (Vercel) has no long-lived process: imports run from GitHub Actions or the cron endpoint.
  if ((process.env.IMPORT_SCHEDULER || (process.env.VERCEL ? "off" : "inprocess")) !== "inprocess") return;
  const { startScheduler } = await import("./lib/importers/scheduler");
  startScheduler();
}
