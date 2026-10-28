import { query } from "@/lib/db";
import { idFromKey, isSafeKey, mimeFromKey, storage } from "@/lib/storage";

/**
 * Serves stored images. Only files of active memes are public, so hiding a meme from the
 * admin panel takes its image offline immediately (cache lifetime is kept short on purpose).
 */
export async function GET(_req: Request, ctx: RouteContext<"/files/[...key]">) {
  const key = (await ctx.params).key.join("/");
  if (!isSafeKey(key)) return new Response("Not found", { status: 404 });
  const [row] = await query<{ status: string }>(
    "SELECT status FROM memes WHERE id = $1 AND (storage_key = $2 OR thumb_key = $2)",
    [idFromKey(key), key],
  );
  if (!row || row.status !== "active") return new Response("Not found", { status: 404 });
  const body = await storage().get(key);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mimeFromKey(key),
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
