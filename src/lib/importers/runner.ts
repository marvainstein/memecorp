import sharp from "sharp";
import { config } from "../config";
import { query } from "../db";
import { ingestImage, newId } from "../memes/ingest";
import { autoTag, isBlocked, isWorkRelated } from "./autotag";
import { HttpError, PoliteHttp, ROBOTS_BLOCKED } from "./http";
import { ocrImage } from "./ocr";
import { ADAPTERS } from "./registry";
import type { Candidate } from "./types";

export type SourceRow = {
  id: string;
  adapter: string;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  interval_minutes: number;
  cursor: unknown;
  running_since: string | Date | null;
  last_run_at: string | Date | null;
  last_success_at: string | Date | null;
  consecutive_failures: number;
  paused_until: string | Date | null;
  last_error: string | null;
  total_imported: number;
};

export type RunSummary = {
  sourceId: string;
  status: "success" | "partial" | "failed" | "skipped";
  fetched: number;
  created: number;
  duplicates: number;
  skipped: number;
  failed: number;
  message?: string;
};

const MIN_SIDE = 200;
/** Circuit breaker: after N consecutive failed runs the source pauses, doubling each time (max 24 h). */
const PAUSE_BASE_MIN = 15;
const PAUSE_MAX_MIN = 24 * 60;
const STALE_LOCK_MIN = 30;

const http = new PoliteHttp(config.import.userAgent);

export async function listSources() {
  return query<SourceRow>("SELECT * FROM import_sources ORDER BY created_at, id");
}

export async function getSource(id: string) {
  const [row] = await query<SourceRow>("SELECT * FROM import_sources WHERE id = $1", [id]);
  return row ?? null;
}

export function sourceProblem(source: SourceRow): string | null {
  const adapter = ADAPTERS[source.adapter];
  if (!adapter) return `Adaptador desconocido: ${source.adapter}`;
  return adapter.missing?.(source.config ?? {}) ?? null;
}

/** Sources that should run now: enabled, configured, not paused, not running, interval elapsed. */
export async function dueSources() {
  const rows = await query<SourceRow>(
    `SELECT * FROM import_sources
     WHERE enabled
       AND (paused_until IS NULL OR paused_until < now())
       AND (running_since IS NULL OR running_since < now() - interval '${STALE_LOCK_MIN} minutes')
       AND (last_run_at IS NULL OR last_run_at + make_interval(mins => interval_minutes) <= now())
     ORDER BY last_run_at NULLS FIRST`,
  );
  return rows.filter((s) => !sourceProblem(s));
}

async function alreadySeen(sourceId: string, c: Candidate) {
  const [row] = await query<{ hit: number }>(
    `SELECT 1 AS hit FROM import_seen WHERE source_id = $1 AND external_id = $2
     UNION ALL SELECT 1 FROM memes WHERE source_url = $3 LIMIT 1`,
    [sourceId, c.externalId, c.pageUrl],
  );
  return Boolean(row);
}

async function markSeen(sourceId: string, externalId: string, outcome: string, memeId: string | null = null) {
  await query(
    `INSERT INTO import_seen (source_id, external_id, outcome, meme_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (source_id, external_id) DO UPDATE SET outcome = $3, meme_id = $4, seen_at = now()`,
    [sourceId, externalId, outcome, memeId],
  );
}

/**
 * Runs one source end to end. Network trouble with a single image never fails the run;
 * only an adapter-level failure (the source itself is down) counts toward the circuit breaker.
 */
async function downloadImage(http: PoliteHttp, c: Candidate) {
  const urls = [c.imageUrl, ...(c.imageUrlFallbacks ?? [])];
  for (let i = 0; ; i++) {
    try {
      return await http.request(urls[i], { kind: "image", maxBytes: config.maxUploadBytes, retries: 2 });
    } catch (err) {
      if (i < urls.length - 1 && err instanceof HttpError && err.status === 404) continue;
      throw err;
    }
  }
}

export async function runSource(sourceId: string, trigger: "schedule" | "manual" | "cli" | "cron" = "schedule"): Promise<RunSummary> {
  const source = await getSource(sourceId);
  if (!source) throw new Error(`Fuente inexistente: ${sourceId}`);
  const summary: RunSummary = { sourceId, status: "success", fetched: 0, created: 0, duplicates: 0, skipped: 0, failed: 0 };
  const runId = newId();
  const logLines: string[] = [];
  const log = (m: string) => {
    logLines.push(m);
    if (logLines.length > 40) logLines.shift();
  };

  const problem = sourceProblem(source);
  if (problem) {
    await query(
      `INSERT INTO import_runs (id, source_id, trigger, status, finished_at, message) VALUES ($1, $2, $3, 'skipped', now(), $4)`,
      [runId, sourceId, trigger, problem],
    );
    await query("UPDATE import_sources SET last_run_at = now(), last_error = $2 WHERE id = $1", [sourceId, problem]);
    return { ...summary, status: "skipped", message: problem };
  }

  // Cross-process lock: only one runner may hold a source at a time.
  const [locked] = await query<{ id: string }>(
    `UPDATE import_sources SET running_since = now()
     WHERE id = $1 AND (running_since IS NULL OR running_since < now() - interval '${STALE_LOCK_MIN} minutes')
     RETURNING id`,
    [sourceId],
  );
  if (!locked) return { ...summary, status: "skipped", message: "Ya se está ejecutando." };
  // A previous process died mid-run (crash, deploy, Ctrl+C): close its run record.
  await query(
    `UPDATE import_runs SET status = 'failed', finished_at = now(), message = 'Interrumpida (el proceso terminó antes de completar)'
     WHERE source_id = $1 AND status = 'running'`,
    [sourceId],
  );

  await query(`INSERT INTO import_runs (id, source_id, trigger, status) VALUES ($1, $2, $3, 'running')`, [runId, sourceId, trigger]);

  try {
    const adapter = ADAPTERS[source.adapter];
    const { candidates, cursor } = await adapter.fetch({
      http,
      config: source.config ?? {},
      cursor: source.cursor,
      limit: config.import.maxPerRun,
      log,
    });
    summary.fetched = candidates.length;

    for (const c of candidates) {
      if (summary.created >= config.import.maxPerRun) break;
      if (c.nsfw) continue;
      if (await alreadySeen(sourceId, c)) {
        summary.duplicates++;
        continue;
      }
      if (isBlocked(`${c.title} ${c.description ?? ""} ${c.altText ?? ""}`, config.import.blocklist)) {
        summary.skipped++;
        await markSeen(sourceId, c.externalId, "blocked-content");
        continue;
      }
      try {
        const res = await downloadImage(http, c);
        const meta = await sharp(res.body).metadata();
        if ((meta.width ?? 0) < MIN_SIDE || (meta.height ?? 0) < MIN_SIDE) {
          summary.skipped++;
          await markSeen(sourceId, c.externalId, "too-small");
          continue;
        }
        // The caption printed on the image is usually where the joke (and the topic) is.
        const ocrText = await ocrImage(res.body);
        if (isBlocked(ocrText, config.import.blocklist)) {
          summary.skipped++;
          await markSeen(sourceId, c.externalId, "blocked-content");
          continue;
        }
        if (!c.topical && !isWorkRelated(ocrText)) {
          summary.skipped++;
          await markSeen(sourceId, c.externalId, "off-topic");
          continue;
        }
        const tagged = autoTag({ ...c, description: [c.description, ocrText].filter(Boolean).join(" ") });
        const result = await ingestImage({
          buffer: res.body,
          origin: "import",
          meta: {
            title: c.title,
            description: c.description ?? "",
            ocrText,
            altText: c.altText ?? c.title,
            sourceUrl: c.pageUrl,
            sourceName: c.sourceName,
            credit: c.author ?? null,
            license: c.license ?? "fair-use",
            tags: tagged.tags,
            categories: tagged.categories,
            languages: tagged.languages,
            status: config.import.autoPublish ? "active" : "pending",
          },
        });
        if (result.ok) {
          summary.created++;
          await markSeen(sourceId, c.externalId, "created", result.meme.id);
        } else {
          if (result.code === "duplicate" || result.code === "similar") summary.duplicates++;
          else summary.skipped++;
          await markSeen(sourceId, c.externalId, result.code, result.existingId ?? null);
        }
      } catch (err) {
        if (err instanceof HttpError && err.message === ROBOTS_BLOCKED) {
          // The image host does not allow bots: a policy skip, not an error.
          summary.skipped++;
          await markSeen(sourceId, c.externalId, "robots");
          continue;
        }
        summary.failed++;
        log(`${c.imageUrl}: ${(err as Error).message}`);
        // Permanent errors (404, robots, too large) are remembered; transient ones are retried next run.
        if (err instanceof HttpError && !err.retryable) await markSeen(sourceId, c.externalId, `http-${err.status || "blocked"}`);
      }
    }

    summary.status = summary.failed > 0 ? "partial" : "success";
    summary.message = logLines.slice(-5).join("\n") || undefined;
    await query(
      `UPDATE import_sources SET running_since = NULL, last_run_at = now(), last_success_at = now(), consecutive_failures = 0,
         paused_until = NULL, last_error = NULL, cursor = $2::jsonb, total_imported = total_imported + $3 WHERE id = $1`,
      [sourceId, JSON.stringify(cursor ?? source.cursor ?? null), summary.created],
    );
  } catch (err) {
    summary.status = "failed";
    summary.message = [(err as Error).message, ...logLines.slice(-4)].join("\n");
    const failures = source.consecutive_failures + 1;
    const pauseMin = failures >= 3 ? Math.min(PAUSE_MAX_MIN, PAUSE_BASE_MIN * 2 ** (failures - 3)) : 0;
    await query(
      `UPDATE import_sources SET running_since = NULL, last_run_at = now(), consecutive_failures = $2, last_error = $3,
         paused_until = CASE WHEN $4::int > 0 THEN now() + make_interval(mins => $4::int) ELSE NULL END
       WHERE id = $1`,
      [sourceId, failures, summary.message.slice(0, 2000), pauseMin],
    );
  }

  await query(
    `UPDATE import_runs SET status = $2, finished_at = now(), fetched = $3, created = $4, duplicates = $5, skipped = $6, failed = $7, message = $8
     WHERE id = $1`,
    [runId, summary.status, summary.fetched, summary.created, summary.duplicates, summary.skipped, summary.failed, summary.message?.slice(0, 2000) ?? null],
  );
  return summary;
}

/** Runs every due source one after another, stopping early when the time budget is spent. */
export async function runDue(opts: { budgetMs?: number; trigger?: "schedule" | "cron" | "cli" } = {}) {
  const started = Date.now();
  const results: RunSummary[] = [];
  for (const source of await dueSources()) {
    if (opts.budgetMs && Date.now() - started > opts.budgetMs) break;
    try {
      results.push(await runSource(source.id, opts.trigger ?? "schedule"));
    } catch (err) {
      results.push({ sourceId: source.id, status: "failed", fetched: 0, created: 0, duplicates: 0, skipped: 0, failed: 0, message: (err as Error).message });
    }
  }
  return results;
}

export async function recentRuns(limit = 30, sourceId?: string) {
  return query<{
    id: string;
    source_id: string;
    trigger: string;
    status: string;
    started_at: string | Date;
    finished_at: string | Date | null;
    fetched: number;
    created: number;
    duplicates: number;
    skipped: number;
    failed: number;
    message: string | null;
  }>(
    `SELECT * FROM import_runs ${sourceId ? "WHERE source_id = $2" : ""} ORDER BY started_at DESC LIMIT $1`,
    sourceId ? [limit, sourceId] : [limit],
  );
}

export async function updateSource(id: string, patch: { enabled?: boolean; intervalMinutes?: number; config?: Record<string, unknown>; name?: string; resetPause?: boolean }) {
  const sets: string[] = [];
  const values: unknown[] = [id];
  const add = (sql: string, v: unknown) => {
    values.push(v);
    sets.push(sql.replace("?", `$${values.length}`));
  };
  if (patch.enabled !== undefined) add("enabled = ?", patch.enabled);
  if (patch.intervalMinutes !== undefined) add("interval_minutes = ?", Math.max(15, Math.min(7 * 24 * 60, Math.round(patch.intervalMinutes))));
  if (patch.config !== undefined) add("config = ?::jsonb", JSON.stringify(patch.config));
  if (patch.name !== undefined) add("name = ?", patch.name.slice(0, 120));
  if (patch.resetPause) sets.push("paused_until = NULL, consecutive_failures = 0, last_error = NULL");
  if (!sets.length) return getSource(id);
  const [row] = await query<SourceRow>(`UPDATE import_sources SET ${sets.join(", ")} WHERE id = $1 RETURNING *`, values);
  return row ?? null;
}

export async function createSource(input: { id: string; adapter: string; name: string; intervalMinutes: number; config: Record<string, unknown> }) {
  if (!ADAPTERS[input.adapter]) throw new Error("Adaptador desconocido");
  const [row] = await query<SourceRow>(
    `INSERT INTO import_sources (id, adapter, name, config, interval_minutes) VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING *`,
    [input.id, input.adapter, input.name, JSON.stringify(input.config), input.intervalMinutes],
  );
  return row;
}
