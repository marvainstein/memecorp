import { clientIp, error, json, rateLimit } from "@/lib/http";
import { createReport } from "@/lib/memes/reports";

/** General notice-and-takedown form (not tied to a meme page): the meme is found from the pasted URL. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`report:${ip}`, 10, 60 * 60 * 1000)) return error("Demasiados reportes. Probá más tarde.", 429);
  const body = await req.json().catch(() => ({}));
  const result = await createReport({ ...body, memeId: null, ip });
  if (!result.ok) return error(result.message);
  return json(result, { status: 201 });
}
