import { requireAdmin } from "@/lib/auth";
import { error, json } from "@/lib/http";
import { removeMeme, setStatus, updateMeme } from "@/lib/memes/repository";
import type { MemeInput, MemeStatus } from "@/lib/memes/types";

const STATUSES: MemeStatus[] = ["active", "pending", "hidden", "rejected"];

export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/memes/[id]">) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as (MemeInput & { status?: MemeStatus }) | null;
  if (!body) return error("JSON inválido.");

  const { status, statusReason, ...meta } = body;
  let meme = Object.keys(meta).length ? await updateMeme(id, meta) : null;
  if (status) {
    if (!STATUSES.includes(status)) return error("Estado inválido.");
    meme = await setStatus(id, status, statusReason ?? null);
  }
  if (!meme && (status || Object.keys(meta).length)) return error("Meme no encontrado.", 404);
  return json({ ok: true, meme });
}

/** Takedown: deletes the files, keeps the hashes so the image can never be re-imported. */
export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/memes/[id]">) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  const meme = await removeMeme(id, "Eliminado por un administrador");
  if (!meme) return error("Meme no encontrado.", 404);
  return json({ ok: true });
}
