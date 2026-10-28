import { Explorer } from "@/components/explorer/Explorer";
import { parseSearchParams, search } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = parseSearchParams(await searchParams);
  const initial = await search({ ...params, q: undefined, limit: 30 });
  return <Explorer initial={initial} params={{ ...params, q: undefined }} />;
}
