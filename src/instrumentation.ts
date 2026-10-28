/** Starts the automatic import scheduler inside the Next.js server (Node.js runtime only). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if ((process.env.IMPORT_SCHEDULER || "inprocess") !== "inprocess") return;
  const { startScheduler } = await import("./lib/importers/scheduler");
  startScheduler();
}
