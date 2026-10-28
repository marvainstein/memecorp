import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { resolveReport, type ReportAction } from "@/lib/memes/reports";

const ACTIONS: ReportAction[] = ["hide", "remove", "dismiss", "restore"];

export async function POST(req: Request, ctx: RouteContext<"/api/admin/reports/[id]">) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (!ACTIONS.includes(body.action)) return error("Acción inválida.");
  const result = await resolveReport(id, body.action, body.note);
  if (!result) return error("Reporte no encontrado.", 404);
  return json({ ok: true });
}
