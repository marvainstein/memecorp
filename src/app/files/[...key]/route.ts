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
  let body: Buffer | null;
  try {
    body = await storage().get(key);
  } catch (err) {
    // Misconfigured bucket (wrong key, endpoint, region...): say what kind of failure it was,
    // never the configuration itself, so a deployment can be diagnosed from the response.
    const e = err as { name?: string; message?: string; Code?: string; code?: string; $metadata?: { httpStatusCode?: number } };
    // Generic errors (missing bucket setting, DNS failure) only make sense with their message; S3 errors are named.
    const detail = e.name === "Error" ? e.message?.slice(0, 120) : undefined;
    const kind = [e.name, e.Code ?? e.code, e.$metadata?.httpStatusCode, detail].filter(Boolean).join(" ").replace(/[^\w .:-]/g, "");
    console.error(`[files] ${key}:`, err);
    return new Response("Storage error", { status: 502, headers: { "X-Storage-Error": kind || "unknown", "Cache-Control": "no-store" } });
  }
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
