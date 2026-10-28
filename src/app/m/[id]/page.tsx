import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { MemeDetail } from "@/components/explorer/MemeDetail";
import { ImageIcon, SearchIcon } from "@/components/win95/Icons";
import { Window } from "@/components/win95/Window";
import { getPublicMeme, incrementCounter, relatedMemes } from "@/lib/memes/repository";

export const dynamic = "force-dynamic";

const load = cache((id: string) => getPublicMeme(id));

export async function generateMetadata({ params }: PageProps<"/m/[id]">): Promise<Metadata> {
  const meme = await load((await params).id);
  if (!meme) return { title: "Meme no disponible", robots: { index: false } };
  const description = meme.description || `${meme.title} — meme ${meme.tags.slice(0, 5).join(", ")}. Descargalo o compartilo gratis.`;
  return {
    title: meme.title,
    description,
    alternates: { canonical: meme.pageUrl },
    openGraph: {
      title: meme.title,
      description,
      type: "article",
      images: [{ url: meme.imageUrl, width: meme.width, height: meme.height, alt: meme.altText }],
    },
    twitter: { card: "summary_large_image", title: meme.title, description, images: [meme.imageUrl] },
  };
}

export default async function MemePage({ params }: PageProps<"/m/[id]">) {
  const { id } = await params;
  const meme = await load(id);
  if (!meme) notFound();
  void incrementCounter(id, "view");
  const related = await relatedMemes(meme, 12);

  return (
    <main id="contenido" className="flex flex-1 flex-col items-center md:p-4 lg:p-6">
      <Window
        title={`Propiedades de ${meme.title}`}
        icon={<ImageIcon />}
        closeHref="/"
        controls="close"
        className="w-full max-w-5xl"
        bodyClassName="p-2 sm:p-3"
      >
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Link href="/" className="win-btn win-btn-sm">
            ← Volver al buscador
          </Link>
          {meme.tags[0] && (
            <Link href={`/search?q=${encodeURIComponent(meme.tags[0])}`} className="win-btn win-btn-sm">
              <SearchIcon /> Más de “{meme.tags[0]}”
            </Link>
          )}
        </div>
        <MemeDetail meme={meme} related={related} />
      </Window>
    </main>
  );
}
