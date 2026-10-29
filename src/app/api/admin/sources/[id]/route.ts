import { after } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { getSource, runSource, sourceProblem, updateSource } from "@/lib/importers/runner";

// Time limit for the background import on serverless hosts (Vercel); unfinished work resumes on the next run.
export const maxDuration = 300;

export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/sources/[id]">) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return error("JSON inválido.");
  if (body.config !== undefined && (typeof body.config !== "object" || Array.isArray(body.config) || body.config === null)) {
    return error("La configuración debe ser un objeto JSON.");
  }
  const source = await updateSource(id, {
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    intervalMinutes: Number.isFinite(body.intervalMinutes) ? body.intervalMinutes : undefined,
    config: body.config,
    resetPause: body.resetPause === true,
  });
  if (!source) return error("Fuente no encontrada.", 404);
  return json({ ok: true });
}

/** "Run now": starts the import in the background and returns immediately. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/sources/[id]">) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const source = await getSource(id);
  if (!source) return error("Fuente no encontrada.", 404);
  const problem = sourceProblem(source);
  if (problem) return error(problem);
  // after() keeps a serverless function alive until the import finishes (or maxDuration).
  after(() => runSource(id, "manual").catch((err) => console.error(`[import] ${id}:`, err)));
  return json({ ok: true, started: true }, { status: 202 });
}
