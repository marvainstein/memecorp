import { error, json } from "@/lib/http";
import { getPublicMeme, incrementCounter, relatedMemes } from "@/lib/memes/repository";

export async function GET(_req: Request, ctx: RouteContext<"/api/memes/[id]">) {
  const { id } = await ctx.params;
  const meme = await getPublicMeme(id);
  if (!meme) return error("Meme no encontrado o retirado.", 404);
  void incrementCounter(id, "view");
  const related = await relatedMemes(meme, 12);
  return json({ meme, related });
}
