"use client";

import Link from "next/link";
import { useState } from "react";
import type { Meme } from "@/lib/memes/types";
import { CATEGORIES, LICENSES } from "@/lib/memes/taxonomy";
import { formatBytes } from "@/lib/text";
import { MemeActions } from "./MemeActions";

const category = (slug: string) => CATEGORIES.find((c) => c.slug === slug);

type Props = {
  meme: Meme;
  related?: Meme[];
  /** When rendered inside the explorer, chip clicks refine the search there instead of navigating. */
  onFilter?: (f: { q?: string; category?: string }) => void;
  onOpenRelated?: (m: Meme) => void;
};

/** Large preview + "Properties" sheet for one meme. Shared by the modal and the /m/[id] page. */
export function MemeDetail({ meme, related, onFilter, onOpenRelated }: Props) {
  const [tab, setTab] = useState<"general" | "origen">("general");
  const license = LICENSES.find((l) => l.slug === meme.license)?.label ?? meme.license;

  const chip = (label: string, f: { q?: string; category?: string }, key: string) =>
    onFilter ? (
      <button key={key} type="button" className="win-chip" onClick={() => onFilter(f)}>
        {label}
      </button>
    ) : (
      <Link key={key} className="win-chip" href={`/search?${new URLSearchParams(f as Record<string, string>)}`}>
        {label}
      </Link>
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="win-sunken flex items-center justify-center p-1" style={{ backgroundColor: meme.dominantColor ?? "#fff" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meme.imageUrl}
            alt={meme.altText}
            width={meme.width}
            height={meme.height}
            className="block h-auto max-h-[55dvh] w-auto max-w-full object-contain"
          />
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="win-tabs" role="tablist">
            <button type="button" role="tab" className="win-tab" aria-selected={tab === "general"} onClick={() => setTab("general")}>
              General
            </button>
            <button type="button" role="tab" className="win-tab" aria-selected={tab === "origen"} onClick={() => setTab("origen")}>
              Origen y licencia
            </button>
          </div>
          <div className="win-tabpanel flex-1 space-y-2" role="tabpanel">
            {tab === "general" ? (
              <>
                <p className="text-[13px] font-bold">{meme.title}</p>
                {meme.description && <p>{meme.description}</p>}
                <div className="win-separator" />
                <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-2 gap-y-1">
                  <dt>Tipo:</dt>
                  <dd>Imagen {meme.format.toUpperCase()}</dd>
                  <dt>Dimensiones:</dt>
                  <dd>
                    {meme.width} × {meme.height} px
                  </dd>
                  <dt>Tamaño:</dt>
                  <dd>{formatBytes(meme.bytes)}</dd>
                  <dt>Idiomas:</dt>
                  <dd>{meme.languages.map((l) => (l === "es" ? "Español" : l === "en" ? "Inglés" : l)).join(", ") || "Sin texto"}</dd>
                  <dt>Descargas:</dt>
                  <dd>{meme.downloadCount.toLocaleString("es-AR")}</dd>
                  <dt>Agregado:</dt>
                  <dd>{new Date(meme.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}</dd>
                </dl>
                {meme.categories.length > 0 && (
                  <>
                    <div className="win-separator" />
                    <p>Categorías:</p>
                    <div className="flex flex-wrap gap-1">{meme.categories.map((c) => chip(category(c)?.es ?? c, { category: c }, c))}</div>
                  </>
                )}
                {meme.tags.length > 0 && (
                  <>
                    <p>Etiquetas:</p>
                    <div className="flex flex-wrap gap-1">{meme.tags.map((t) => chip(`#${t}`, { q: t }, t))}</div>
                  </>
                )}
              </>
            ) : (
              <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-2 gap-y-1.5">
                <dt>Fuente:</dt>
                <dd className="break-words">
                  {meme.sourceUrl ? (
                    <a href={meme.sourceUrl} target="_blank" rel="noopener noreferrer nofollow ugc">
                      {meme.sourceName || new URL(meme.sourceUrl).hostname}
                    </a>
                  ) : (
                    meme.sourceName || "Sin especificar"
                  )}
                </dd>
                <dt>Crédito:</dt>
                <dd>{meme.credit || "Desconocido"}</dd>
                <dt>Licencia:</dt>
                <dd>{license}</dd>
                <dt>Indexado:</dt>
                <dd>{meme.origin === "import" ? "Automáticamente" : meme.origin === "seed" ? "Original de MemeCorp" : "Por un administrador"}</dd>
                <dt className="col-span-2 mt-2 text-win-dark">
                  MemeCorp aloja contenido aportado por terceros con fines de humor, parodia y comentario. ¿Es tuyo y querés que lo retiremos?
                  Usá “Reportar” o el <Link href="/aviso-y-retirada">aviso y retirada</Link>.
                </dt>
              </dl>
            )}
          </div>
        </div>
      </div>

      <MemeActions meme={meme} />

      {related && related.length > 0 && (
        <fieldset className="win-groupbox">
          <legend>Memes relacionados</legend>
          <div className="grid grid-cols-3 gap-2 xs:grid-cols-4 sm:grid-cols-6">
            {related.map((m) =>
              onOpenRelated ? (
                <button key={m.id} type="button" className="border-0 bg-transparent p-0" onClick={() => onOpenRelated(m)} title={m.title}>
                  <RelatedThumb meme={m} />
                </button>
              ) : (
                <Link key={m.id} href={m.pageUrl} title={m.title}>
                  <RelatedThumb meme={m} />
                </Link>
              ),
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}

function RelatedThumb({ meme }: { meme: Meme }) {
  return (
    <span className="block aspect-square p-[2px] shadow-[var(--bevel-thin-sunken)]" style={{ backgroundColor: meme.dominantColor ?? "#dfdfdf" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={meme.thumbUrl} alt={meme.altText} loading="lazy" className="h-full w-full object-cover" />
    </span>
  );
}
