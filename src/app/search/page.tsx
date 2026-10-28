import type { Metadata } from "next";
import { Explorer } from "@/components/explorer/Explorer";
import { CATEGORIES, EMOTIONS } from "@/lib/memes/taxonomy";
import { parseSearchParams, search } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const p = parseSearchParams(await searchParams);
  const label = [p.q && `“${p.q}”`, EMOTIONS.find((e) => e.slug === p.emotion)?.es, CATEGORIES.find((c) => c.slug === p.category)?.es]
    .filter(Boolean)
    .join(" · ");
  return {
    title: label ? `Memes de ${label}` : "Buscar memes",
    description: `Memes corporativos estáticos${label ? ` sobre ${label}` : ""}: descargá o compartí en segundos.`,
  };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = parseSearchParams(await searchParams);
  const initial = await search({ ...params, page: 1, limit: 30 });
  return <Explorer initial={initial} params={params} />;
}
