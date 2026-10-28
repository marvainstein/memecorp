import { clientIp, error, json, rateLimit } from "@/lib/http";
import { createReport } from "@/lib/memes/reports";

export async function POST(req: Request, ctx: RouteContext<"/api/memes/[id]/report">) {
  const { id } = await ctx.params;
  const ip = clientIp(req);
  if (!rateLimit(`report:${ip}`, 10, 60 * 60 * 1000)) return error("Demasiados reportes. Probá más tarde.", 429);
  const body = await req.json().catch(() => ({}));
  const result = await createReport({ ...body, memeId: id, ip });
  if (!result.ok) return error(result.message);
  return json(result, { status: 201 });
}
