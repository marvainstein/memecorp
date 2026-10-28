import { error } from "@/lib/http";
import { getMemeRow, incrementCounter } from "@/lib/memes/repository";
import { storage } from "@/lib/storage";

/** Streams the original file as an attachment (keeps format and quality) and counts the download. */
export async function GET(_req: Request, ctx: RouteContext<"/api/memes/[id]/download">) {
  const { id } = await ctx.params;
  const row = await getMemeRow(id);
  if (!row || row.status !== "active" || !row.storage_key) return error("Meme no disponible.", 404);
  const body = await storage().get(row.storage_key);
  if (!body) return error("El archivo no está disponible.", 404);
  await incrementCounter(id, "download");
  const filename = `${row.slug || "meme"}-memedesk.${row.format}`;
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
