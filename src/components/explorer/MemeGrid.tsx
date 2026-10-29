"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Meme } from "@/lib/memes/types";
import { formatBytes } from "@/lib/text";
import { DownloadIcon, ImageIcon } from "../win95/Icons";

export type ViewMode = "large" | "small" | "details";

type Props = {
  items: Meme[];
  view: ViewMode;
  selectedId?: string | null;
  onOpen: (meme: Meme) => void;
};

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Number of masonry columns that fit the container. */
function useColumns(ref: React.RefObject<HTMLElement | null>, minWidth: number) {
  const [cols, setCols] = useState(4);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setCols(Math.max(2, Math.floor((el.clientWidth + 8) / (minWidth + 8))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, minWidth]);
  return cols;
}

export function MemeGrid({ items, view, selectedId, onOpen }: Props) {
  if (view === "details") return <DetailsView items={items} selectedId={selectedId} onOpen={onOpen} />;
  return <Masonry items={items} small={view === "small"} selectedId={selectedId} onOpen={onOpen} />;
}

function Masonry({ items, small, selectedId, onOpen }: { items: Meme[]; small: boolean; selectedId?: string | null; onOpen: (m: Meme) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cols = useColumns(ref, small ? 130 : 210);

  // Greedy shortest-column placement keeps earlier tiles in place when more pages load.
  const columns = useMemo(() => {
    const out: Meme[][] = Array.from({ length: cols }, () => []);
    const heights = new Array(cols).fill(0);
    for (const m of items) {
      const i = heights.indexOf(Math.min(...heights));
      out[i].push(m);
      heights[i] += m.height / m.width + 0.18; // + label
    }
    return out;
  }, [items, cols]);

  return (
    <div ref={ref} className="flex items-start gap-2">
      {columns.map((col, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-2">
          {col.map((m) => (
            <Tile key={m.id} meme={m} small={small} selected={m.id === selectedId} onOpen={onOpen} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Tile({ meme, small, selected, onOpen }: { meme: Meme; small: boolean; selected: boolean; onOpen: (m: Meme) => void }) {
  return (
    <div className={`group relative ${selected ? "tile-selected" : ""}`}>
      <button
        type="button"
        className="block w-full cursor-pointer border-0 bg-transparent p-1 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black"
        onClick={() => onOpen(meme)}
        title={meme.title}
      >
        <span className="block p-[2px] shadow-[var(--bevel-thin-sunken)]" style={{ backgroundColor: meme.dominantColor ?? "#dfdfdf" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={meme.thumbUrl}
            alt={meme.altText}
            width={meme.width}
            height={meme.height}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
            style={{ aspectRatio: `${meme.width} / ${meme.height}` }}
          />
        </span>
        <span className={`tile-label mt-1 block text-center ${small ? "line-clamp-1 text-[11px]" : "line-clamp-2"}`}>{meme.title}</span>
        {meme.partialMatch && <PartialBadge />}
      </button>
      {!small && (
        <a
          href={`/api/memes/${meme.id}/download`}
          className="win-btn win-btn-sm absolute right-2 top-2 hidden min-w-0 px-1 group-hover:inline-flex group-focus-within:inline-flex"
          aria-label={`Descargar ${meme.title}`}
          title="Descargar"
          download
        >
          <DownloadIcon />
        </a>
      )}
    </div>
  );
}

/** Marks results that match only some of the search words. */
function PartialBadge() {
  return (
    <span className="mx-auto mt-0.5 block w-fit shrink-0 bg-win-yellow px-1 text-[11px] shadow-[var(--bevel-thin-sunken)]" title="Coincide con alguna de las palabras, no con todas">
      sugerencia
    </span>
  );
}

function DetailsView({ items, selectedId, onOpen }: { items: Meme[]; selectedId?: string | null; onOpen: (m: Meme) => void }) {
  return (
    <div className="overflow-x-auto win-scroll">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr>
            {["Nombre", "Tipo", "Tamaño", "Dimensiones", "Descargas"].map((h) => (
              <th key={h} className="sticky top-0 z-[1] bg-win-gray px-2 py-0.5 font-normal shadow-[var(--bevel-raised)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr
              key={m.id}
              className={`cursor-pointer ${m.id === selectedId ? "bg-win-navy text-white" : "hover:bg-win-navy hover:text-white"}`}
              onClick={() => onOpen(m)}
            >
              <td className="px-2 py-0.5">
                <button type="button" className="flex items-center gap-2 border-0 bg-transparent p-0 text-left text-inherit" onClick={() => onOpen(m)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.thumbUrl} alt="" width={28} height={28} loading="lazy" className="h-7 w-7 object-cover" />
                  <span className="line-clamp-1">{m.title}</span>
                  {m.partialMatch && <PartialBadge />}
                </button>
              </td>
              <td className="whitespace-nowrap px-2">
                <span className="inline-flex items-center gap-1">
                  <ImageIcon /> {m.format.toUpperCase()}
                </span>
              </td>
              <td className="whitespace-nowrap px-2 text-right">{formatBytes(m.bytes)}</td>
              <td className="whitespace-nowrap px-2">
                {m.width}×{m.height}
              </td>
              <td className="whitespace-nowrap px-2 text-right">{m.downloadCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
