import { json } from "@/lib/http";
import { parseSearchParams, search } from "@/lib/search";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = parseSearchParams(url.searchParams);
  const limit = Number(url.searchParams.get("limit")) || 30;
  const result = await search({ ...params, limit });
  return json(result, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } });
}
