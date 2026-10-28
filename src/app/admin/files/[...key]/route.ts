import { requireAdmin } from "@/lib/auth";
import { isSafeKey, mimeFromKey, storage } from "@/lib/storage";

/** Serves any stored image (including hidden / pending memes) to authenticated admins. */
export async function GET(req: Request, ctx: RouteContext<"/admin/files/[...key]">) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const key = (await ctx.params).key.join("/");
  if (!isSafeKey(key)) return new Response("Not found", { status: 404 });
  const body = await storage().get(key);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(body), { headers: { "Content-Type": mimeFromKey(key), "Cache-Control": "private, max-age=60" } });
}
