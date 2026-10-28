import { config } from "@/lib/config";
import { error, json } from "@/lib/http";
import { runDue } from "@/lib/importers/runner";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Entry point for external schedulers (Vercel Cron, GitHub Actions, cron-job.org...).
 * Requires `Authorization: Bearer $CRON_SECRET`. Runs due sources within a time budget.
 */
export async function GET(req: Request) {
  if (!config.import.cronSecret) return error("CRON_SECRET no está configurado.", 503);
  if (req.headers.get("authorization") !== `Bearer ${config.import.cronSecret}`) return error("No autorizado.", 401);
  const results = await runDue({ budgetMs: 240_000, trigger: "cron" });
  return json({ ok: true, results });
}
