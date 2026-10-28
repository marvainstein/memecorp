"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Meme } from "@/lib/memes/types";
import type { SearchParams, SearchResult, SortMode } from "@/lib/search";
import { CATEGORIES, FORMATS } from "@/lib/memes/taxonomy";
import { Dialog } from "../win95/Dialog";
import { DiceIcon, FolderIcon, HelpIcon, ImageIcon, InfoIcon, LogoIcon, SearchIcon } from "../win95/Icons";
import { MenuBar, type Menu } from "../win95/MenuBar";
import { openAbout } from "../win95/Taskbar";
import { Window } from "../win95/Window";
import { MemeDetail } from "./MemeDetail";
import { MemeGrid, type ViewMode } from "./MemeGrid";
import { SearchBox, type SearchBoxHandle } from "./SearchBox";

type Filters = { category?: string; format?: string; lang?: string; sort: SortMode };

const EXAMPLES = ["reunión que podría ser un email", "lunes", "jefe", "burnout", "sueldo", "home office", "excel", "renuncia", "deploy viernes", "fake smile"];

const PAGE_SIZE = 30;
const VIEW_KEY = "memedesk:view";

/**
 * Updates the address bar without involving the Next router. Next patches history.pushState and
 * would treat a query-string change as a new page (remounting the explorer and losing its state).
 */
function setUrl(method: "push" | "replace", url: string) {
  const fn = method === "push" ? History.prototype.pushState : History.prototype.replaceState;
  fn.call(window.history, window.history.state, "", url);
}

function toQuery(q: string, f: Filters) {
  const p = new URLSearchParams();
  if (q.trim()) p.set("q", q.trim());
  if (f.category) p.set("category", f.category);
  if (f.format) p.set("format", f.format);
  if (f.lang) p.set("lang", f.lang);
  if (f.sort !== "relevance") p.set("sort", f.sort);
  return p;
}

const describe = (q: string, f: Filters) => {
  const parts: string[] = [];
  if (q.trim()) parts.push(`“${q.trim()}”`);
  if (f.category) parts.push(CATEGORIES.find((c) => c.slug === f.category)?.es ?? f.category);
  if (f.format) parts.push(f.format.toUpperCase());
  return parts.join(" · ");
};

export function Explorer({ initial, params }: { initial: SearchResult; params: SearchParams }) {
  const [q, setQ] = useState(params.q ?? "");
  const [filters, setFilters] = useState<Filters>({
    category: params.category,
    format: params.format,
    lang: params.lang,
    sort: params.sort ?? "relevance",
  });
  const [result, setResult] = useState(initial);
  const [items, setItems] = useState<Meme[]>(initial.items);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<ViewMode>("large");
  const [selected, setSelected] = useState<Meme | null>(null);
  const [related, setRelated] = useState<Meme[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [foldersOpen, setFoldersOpen] = useState(false);

  const searchBox = useRef<SearchBoxHandle>(null);
  const categorySelect = useRef<HTMLSelectElement>(null);
  const pane = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const pushedDetail = useRef(false);
  const listUrl = useRef<string>("/");
  const state = useRef({ q, filters, result, loading });
  state.current = { q, filters, result, loading };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY) as ViewMode | null;
      if (saved === "large" || saved === "small" || saved === "details") setView(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const changeView = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const run = useCallback(async (nextQ: string, nextFilters: Filters, page = 1) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const qs = toQuery(nextQ, nextFilters);
    if (page === 1) {
      const url = qs.size ? `/search?${qs}` : "/";
      listUrl.current = url;
      if (!pushedDetail.current) setUrl("replace", url);
    }
    const apiQs = new URLSearchParams(qs);
    apiQs.set("page", String(page));
    apiQs.set("limit", String(PAGE_SIZE));
    if (page > 1 && state.current.result.relaxed) apiQs.set("relaxed", "1");
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/search?${apiQs}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as SearchResult;
      setResult(data);
      setItems((prev) => (page === 1 ? data.items : [...prev, ...data.items.filter((m) => !prev.some((p) => p.id === m.id))]));
      if (page === 1) pane.current?.scrollTo({ top: 0 });
    } catch (err) {
      if ((err as Error).name !== "AbortError") setFailed(true);
    } finally {
      if (abort.current === ctrl) setLoading(false);
    }
  }, []);

  // Search as you type (debounced). Explicit actions (Enter, filters, chips) call search() directly.
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipDebounce = useRef(true); // the server already rendered the first page
  useEffect(() => {
    if (skipDebounce.current) {
      skipDebounce.current = false;
      return;
    }
    debounce.current = setTimeout(() => run(q, state.current.filters), 320);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q, run]);

  useEffect(() => {
    listUrl.current = window.location.pathname.startsWith("/m/") ? "/" : window.location.pathname + window.location.search;
  }, []);

  const search = (nextQ: string, nextFilters: Filters) => {
    if (debounce.current) clearTimeout(debounce.current);
    if (nextQ !== state.current.q) {
      skipDebounce.current = true;
      setQ(nextQ);
    }
    setFilters(nextFilters);
    run(nextQ, nextFilters);
  };

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const { result: r, loading: busy, q: cq, filters: cf } = state.current;
        if (entries[0].isIntersecting && !busy && r.hasMore) run(cq, cf, r.page + 1);
      },
      { root: pane.current, rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [run, items.length]);

  // "/" focuses the search box, like many search UIs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        e.preventDefault();
        searchBox.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Detail modal ↔ URL (/m/:id) so the address bar is always shareable and Back closes the modal.
  const openMeme = useCallback((m: Meme) => {
    setSelected(m);
    setRelated([]);
    if (!pushedDetail.current) {
      setUrl("push", m.pageUrl);
      pushedDetail.current = true;
    } else {
      setUrl("replace", m.pageUrl);
    }
    fetch(`/api/memes/${m.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { meme: Meme; related: Meme[] } | null) => {
        if (d) setRelated(d.related);
      })
      .catch(() => {});
  }, []);

  const closeMeme = useCallback(() => {
    setSelected(null);
    if (pushedDetail.current) {
      pushedDetail.current = false;
      window.history.back();
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      const match = window.location.pathname.match(/^\/m\/([A-Za-z0-9]+)/);
      if (!match) {
        pushedDetail.current = false;
        setSelected(null);
        return;
      }
      // Forward button back onto a meme: reopen it.
      pushedDetail.current = true;
      fetch(`/api/memes/${match[1]}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { meme: Meme; related: Meme[] } | null) => {
          if (d) {
            setSelected(d.meme);
            setRelated(d.related);
          }
        })
        .catch(() => {});
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const applyFilter = (patch: Partial<Filters> & { q?: string }) => {
    const { q: nextQ, ...rest } = patch;
    if (selected) closeMeme();
    setFoldersOpen(false);
    search(nextQ ?? state.current.q, { ...state.current.filters, ...rest });
  };

  const submit = (value: string) => search(value, state.current.filters);

  const clearAll = () => search("", { sort: "relevance" });

  const copySearchLink = async () => {
    const url = new URL(listUrl.current, window.location.origin).toString();
    await navigator.clipboard?.writeText(url).catch(() => {});
  };

  const menus: Menu[] = useMemo(
    () => [
      {
        label: "Archivo",
        accessKey: "A",
        items: [
          { label: "Nueva búsqueda", icon: <SearchIcon />, onSelect: () => (clearAll(), searchBox.current?.focus()) },
          { type: "separator" },
          { label: "Panel de control", href: "/admin" },
        ],
      },
      {
        label: "Editar",
        accessKey: "E",
        items: [
          { label: "Copiar enlace de la búsqueda", onSelect: copySearchLink },
          { label: "Limpiar búsqueda y filtros", onSelect: clearAll },
        ],
      },
      {
        label: "Ver",
        accessKey: "V",
        items: [
          { label: "Iconos grandes", checked: view === "large", onSelect: () => changeView("large") },
          { label: "Iconos pequeños", checked: view === "small", onSelect: () => changeView("small") },
          { label: "Detalles", checked: view === "details", onSelect: () => changeView("details") },
          { type: "separator" },
          { label: "Ordenar por relevancia", checked: filters.sort === "relevance", onSelect: () => applyFilter({ sort: "relevance" }) },
          { label: "Ordenar por populares", checked: filters.sort === "popular", onSelect: () => applyFilter({ sort: "popular" }) },
          { label: "Ordenar por recientes", checked: filters.sort === "new", onSelect: () => applyFilter({ sort: "new" }) },
        ],
      },
      {
        label: "Buscar",
        accessKey: "B",
        items: [
          { label: "Buscar…", shortcut: "/", icon: <SearchIcon />, onSelect: () => searchBox.current?.focus() },
          { label: "Filtrar por categoría…", onSelect: () => categorySelect.current?.focus() },
          { label: "Meme al azar", icon: <DiceIcon />, href: "/random" },
        ],
      },
      {
        label: "Ayuda",
        accessKey: "y",
        items: [
          { label: "Cómo buscar", icon: <HelpIcon />, onSelect: () => setHelpOpen(true) },
          { label: "Aviso y retirada (DMCA)", href: "/aviso-y-retirada" },
          { type: "separator" },
          { label: "Acerca de MemeDesk", onSelect: openAbout },
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, filters.sort],
  );

  const label = describe(q, filters);
  const browsing = !q.trim() && !filters.category && !filters.format;
  const title = selected ? selected.title : label ? `Buscar: ${label}` : "Memes populares";

  return (
    <main id="contenido" className="flex min-h-0 flex-1 flex-col md:p-3 lg:p-5">
      <h1 className="sr-only">MemeDesk: buscador de memes corporativos</h1>
      <Window title={`MemeDesk — ${title}`} className="mx-auto h-[calc(100dvh-36px)] w-full max-w-[1500px] md:h-[calc(100dvh-36px-24px)] lg:h-[calc(100dvh-36px-40px)]">
        <MenuBar menus={menus} />
        <div className="win-separator !m-0" />

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 px-1 py-1">
          <Link href="/" className="win-btn win-btn-sm hidden min-w-0 gap-1 sm:inline-flex" onClick={(e) => (e.preventDefault(), clearAll())}>
            <LogoIcon /> Inicio
          </Link>
          <Link href="/random" className="win-btn win-btn-sm min-w-0 gap-1">
            <DiceIcon /> <span className="hidden xs:inline">Al azar</span>
          </Link>
          <div className="win-vseparator hidden sm:block" />
          <div className="ml-auto flex gap-0.5 sm:ml-0" role="group" aria-label="Vista">
            {(["large", "small", "details"] as ViewMode[]).map((v) => (
              <button key={v} type="button" className="win-btn win-btn-sm min-w-0 px-2" aria-pressed={view === v} onClick={() => changeView(v)} title={v === "large" ? "Iconos grandes" : v === "small" ? "Iconos pequeños" : "Detalles"}>
                {v === "large" ? "▦" : v === "small" ? "▩" : "☰"}
              </button>
            ))}
          </div>
        </div>

        {/* Search row */}
        <form
          role="search"
          className="flex items-center gap-1.5 px-1 pb-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            submit(q);
          }}
        >
          <span className="hidden shrink-0 sm:block" aria-hidden>
            <span className="underline">B</span>uscar:
          </span>
          <SearchBox ref={searchBox} value={q} onChange={setQ} onSubmit={submit} onPickFilter={(f) => applyFilter({ ...f, q: "" })} />
          <button type="submit" className="win-btn shrink-0">
            Buscar
          </button>
        </form>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-1.5 px-1 pb-1.5 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect ref={categorySelect} label="Categoría" value={filters.category} onChange={(v) => applyFilter({ category: v })} options={CATEGORIES.map((c) => [c.slug, c.es])} />
          <FilterSelect label="Formato" value={filters.format} onChange={(v) => applyFilter({ format: v })} options={FORMATS.map((f) => [f.slug, f.label])} />
          <FilterSelect
            label="Orden"
            value={filters.sort}
            allowEmpty={false}
            onChange={(v) => applyFilter({ sort: (v as SortMode) ?? "relevance" })}
            options={[
              ["relevance", "Relevancia"],
              ["popular", "Populares"],
              ["new", "Recientes"],
            ]}
          />
          <button type="button" className="win-btn win-btn-sm md:hidden" onClick={() => setFoldersOpen((o) => !o)} aria-expanded={foldersOpen}>
            <FolderIcon open={foldersOpen} /> Categorías
          </button>
          {!browsing && (
            <button type="button" className="win-btn win-btn-sm" onClick={clearAll}>
              Limpiar
            </button>
          )}
        </div>

        {foldersOpen && (
          <div className="flex flex-wrap gap-1 px-1 pb-1.5 md:hidden">
            {CATEGORIES.map((c) => (
              <button key={c.slug} type="button" className="win-chip" aria-pressed={filters.category === c.slug} onClick={() => applyFilter({ category: filters.category === c.slug ? undefined : c.slug })}>
                {c.es}
              </button>
            ))}
          </div>
        )}

        <div className="flex min-h-0 flex-1 gap-1 px-1">
          {/* Folder tree */}
          <aside className="win-sunken win-scroll hidden w-52 shrink-0 overflow-y-auto p-1 md:block lg:w-60" aria-label="Carpetas">
            <TreeItem depth={0} icon={<FolderIcon open />} label="Todos los memes" active={browsing} onClick={clearAll} />
            <p className="mt-1 px-1 text-win-dark">Categorías</p>
            {CATEGORIES.map((c) => (
              <TreeItem
                key={c.slug}
                depth={1}
                icon={<FolderIcon open={filters.category === c.slug} />}
                label={c.es}
                active={filters.category === c.slug}
                onClick={() => applyFilter({ category: filters.category === c.slug ? undefined : c.slug })}
              />
            ))}
          </aside>

          {/* Results */}
          <div ref={pane} className="win-sunken win-scroll min-w-0 flex-1 overflow-y-auto p-2" aria-busy={loading} aria-live="polite">
            {browsing && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-dotted border-win-dark pb-2">
                <span className="mr-1 font-bold">Probá con:</span>
                {EXAMPLES.map((ex) => (
                  <button key={ex} type="button" className="win-chip" onClick={() => search(ex, filters)}>
                    {ex}
                  </button>
                ))}
              </div>
            )}
            {result.relaxed && items.length > 0 && (
              <div className="mb-2 flex items-center gap-2 bg-win-yellow p-1.5 shadow-[var(--bevel-thin-sunken)]">
                <InfoIcon size={16} /> Ningún meme coincide con todas las palabras; mostrando los que coinciden con alguna.
              </div>
            )}
            {items.length > 0 ? (
              <MemeGrid items={items} view={view} selectedId={selected?.id} onOpen={openMeme} />
            ) : loading ? null : (
              <EmptyState query={label} failed={failed} onRetry={() => run(q, filters)} onClear={clearAll} />
            )}
            <div ref={sentinel} className="h-1" />
            {loading && (
              <div className="mx-auto my-4 w-64 max-w-full">
                <p className="mb-1">Buscando memes…</p>
                <div className="win-progress">
                  <span className="w-2/3 animate-pulse" />
                </div>
              </div>
            )}
            {!result.hasMore && items.length > PAGE_SIZE && <p className="my-4 text-center text-win-dark">— Fin de los resultados —</p>}
          </div>
        </div>

        <footer className="win-statusbar px-1 pb-0.5">
          <span className="win-status-cell w-32 shrink-0">{result.total.toLocaleString("es-AR")} objeto(s)</span>
          <span className="win-status-cell min-w-0 flex-1">{label ? `Búsqueda: ${label}` : "Todos los memes"}</span>
          <span className="win-status-cell hidden w-28 shrink-0 sm:block">{loading ? "Buscando…" : `${result.tookMs} ms`}</span>
        </footer>
      </Window>

      <Dialog open={!!selected} onClose={closeMeme} title={selected ? `Propiedades de ${selected.title}` : ""} icon={<ImageIcon />} size="max-w-5xl">
        {selected && (
          <MemeDetail
            meme={selected}
            related={related}
            onFilter={(f) => applyFilter({ q: f.q ?? "", category: f.category })}
            onOpenRelated={openMeme}
          />
        )}
      </Dialog>

      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} title="Cómo buscar" icon={<HelpIcon />} size="max-w-lg">
        <div className="space-y-2">
          <p>Escribí lo que querés expresar, como se lo dirías a un compañero:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Situaciones:</b> “reunión que podría ser un email”, “jefe a las 6 de la tarde”, “deploy viernes”.
            </li>
            <li>
              <b>Series:</b> “the office”, “parks and rec”, “nathan for you”, “severance”, o un personaje como “dwight”.
            </li>
            <li>
              <b>En los dos idiomas:</b> “jefe” también encuentra “boss” y “manager”; “lunes” encuentra “monday”.
            </li>
            <li>
              <b>Con errores de tipeo:</b> “reunon” o “burnaut” también funcionan.
            </li>
          </ul>
          <p>
            Atajo: <kbd className="win-raised px-1">/</kbd> enfoca la búsqueda. Cada búsqueda tiene su propio enlace para compartir.
          </p>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className="win-btn win-btn-default" onClick={() => setHelpOpen(false)}>
            Aceptar
          </button>
        </div>
      </Dialog>
    </main>
  );
}

type FilterSelectProps = {
  label: string;
  value?: string;
  options: [string, string][];
  onChange: (value: string | undefined) => void;
  allowEmpty?: boolean;
  ref?: React.Ref<HTMLSelectElement>;
};

function FilterSelect({ label, value, options, onChange, allowEmpty = true, ref }: FilterSelectProps) {
  return (
    <label className="flex min-w-0 items-center gap-1">
      <span className="shrink-0">{label}:</span>
      <select ref={ref} className="win-field min-w-0 py-0.5 sm:w-auto" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
        {allowEmpty && <option value="">(Todas)</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function TreeItem({ depth, icon, label, hint, active, onClick }: { depth: number; icon: React.ReactNode; label: string; hint?: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex w-full items-center gap-1.5 border-0 bg-transparent py-[1px] text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted"
      style={{ paddingLeft: 4 + depth * 14 }}
      title={hint}
    >
      {depth > 0 && <span className="w-2 shrink-0 border-b border-dotted border-win-dark" aria-hidden />}
      {icon}
      <span className={`truncate px-0.5 ${active ? "bg-win-navy text-white" : ""}`}>{label}</span>
    </button>
  );
}

function EmptyState({ query, failed, onRetry, onClear }: { query: string; failed: boolean; onRetry: () => void; onClear: () => void }) {
  return (
    <div className="mx-auto my-8 max-w-md">
      <div className="win-window">
        <div className="win-titlebar">
          <span className="win-titlebar-title">{failed ? "Error" : "Búsqueda finalizada"}</span>
        </div>
        <div className="flex gap-3 p-3">
          <InfoIcon />
          <div className="space-y-2">
            {failed ? (
              <p>No se pudo completar la búsqueda. Revisá tu conexión e intentá de nuevo.</p>
            ) : (
              <>
                <p>
                  No se encontraron memes para <b>{query || "esta búsqueda"}</b>.
                </p>
                <p>Probá con menos palabras, sinónimos (“jefe”, “boss”) o quitá algún filtro.</p>
              </>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {failed ? (
                <button type="button" className="win-btn win-btn-default" onClick={onRetry}>
                  Reintentar
                </button>
              ) : (
                <>
                  <button type="button" className="win-btn win-btn-default" onClick={onClear}>
                    Ver todos
                  </button>
                  <Link href="/random" className="win-btn">
                    Meme al azar
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
