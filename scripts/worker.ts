/**
 * Standalone import worker for deployments where the web server should not import
 * (set IMPORT_SCHEDULER=off on the web process and run `npm run worker` next to it).
 * Requires DATABASE_URL (PostgreSQL): PGlite cannot be shared between processes.
 */
import { closeDb } from "@/lib/db";
import { startScheduler } from "@/lib/importers/scheduler";

if (!process.env.DATABASE_URL) {
  console.error("El worker necesita DATABASE_URL. Con PGlite, el planificador corre dentro de `npm run dev` / `npm start`.");
  process.exit(1);
}

startScheduler();
// Keep the process alive (the scheduler timer is unref'd so the web server can exit cleanly).
const keepAlive = setInterval(() => {}, 1 << 30);

const shutdown = async () => {
  clearInterval(keepAlive);
  await closeDb();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
