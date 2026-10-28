import { json } from "@/lib/http";
import { suggest } from "@/lib/search";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const items = await suggest(q.slice(0, 60));
  return json({ items }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } });
}
