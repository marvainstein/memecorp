import { clientIp, json, rateLimit } from "@/lib/http";
import { incrementCounter } from "@/lib/memes/repository";

export async function POST(req: Request, ctx: RouteContext<"/api/memes/[id]/share">) {
  const { id } = await ctx.params;
  if (rateLimit(`share:${clientIp(req)}:${id}`, 5, 60 * 60 * 1000)) await incrementCounter(id, "share");
  return json({ ok: true });
}
