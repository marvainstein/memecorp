import Link from "next/link";
import { listSources, recentRuns, sourceProblem } from "@/lib/importers/runner";
import { stats } from "@/lib/memes/repository";
import { CATEGORIES } from "@/lib/memes/taxonomy";
import { formatBytes } from "@/lib/text";
import { adminSrc } from "./paths";
import { StatusBadge } from "./ui";

const fmt = (d: string | Date | null) => (d ? new Date(d).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—");

export default async function AdminDashboard() {
  const [s, sources, runs] = await Promise.all([stats(), listSources(), recentRuns(8)]);
  const c = s.counts;
  const cards: [string, string | number, string?][] = [
    ["Publicados", c.active, "/admin/memes?status=active"],
    ["Pendientes", c.pending, "/admin/memes?status=pending"],
    ["Ocultos", c.hidden, "/admin/memes?status=hidden"],
    ["Eliminados", c.removed, "/admin/memes?status=removed"],
    ["Reportes abiertos", c.open_reports, "/admin/reports"],
    ["Descargas", c.downloads],
    ["Compartidos", c.shares],
    ["Vistas", c.views],
    ["Almacenamiento", formatBytes(c.bytes)],
    ["Búsquedas distintas", c.distinct_queries],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(([label, value, href]) => {
          const inner = (
            <>
              <div className="text-win-dark">{label}</div>
              <div className="text-xl font-bold">{typeof value === "number" ? value.toLocaleString("es-AR") : value}</div>
            </>
          );
          return href ? (
            <Link key={label} href={href} className="win-sunken block p-2 text-inherit no-underline hover:outline hover:outline-1 hover:outline-dotted">
              {inner}
            </Link>
          ) : (
            <div key={label} className="win-sunken p-2">
              {inner}
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <fieldset className="win-groupbox">
          <legend>Importación automática</legend>
          <table className="w-full text-left">
            <tbody>
              {sources.map((src) => {
                const problem = sourceProblem(src);
                return (
                  <tr key={src.id} className="border-b border-dotted border-win-dark">
                    <td className="py-1 pr-2">
                      <Link href="/admin/sources">{src.name}</Link>
                    </td>
                    <td className="whitespace-nowrap pr-2">
                      {!src.enabled ? (
                        <StatusBadge status="skipped" />
                      ) : problem ? (
                        <span className="text-[#c00000]">⚠ falta configurar</span>
                      ) : src.paused_until && new Date(src.paused_until) > new Date() ? (
                        <span className="text-[#c00000]">en pausa</span>
                      ) : (
                        <StatusBadge status={src.consecutive_failures ? "failed" : "success"} />
                      )}
                    </td>
                    <td className="whitespace-nowrap text-right">{src.total_imported} importados</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-win-dark">Últimas ejecuciones:</p>
          <ul className="space-y-0.5">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={r.status} /> {fmt(r.started_at)} · {r.source_id} · {r.created} nuevos
              </li>
            ))}
            {!runs.length && <li>Todavía no corrió ninguna importación.</li>}
          </ul>
        </fieldset>

        <fieldset className="win-groupbox">
          <legend>Más descargados</legend>
          <div className="grid grid-cols-4 gap-2">
            {s.top.map((m) => (
              <Link key={m.id} href={`/admin/memes/${m.id}`} title={`${m.title} · ${m.downloadCount} descargas`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={adminSrc(m.thumbUrl)} alt={m.altText} className="aspect-square w-full object-cover shadow-[var(--bevel-thin-sunken)]" loading="lazy" />
                <span className="block truncate text-[11px]">{m.downloadCount} ↓</span>
              </Link>
            ))}
          </div>
        </fieldset>

        <fieldset className="win-groupbox">
          <legend>Búsquedas más frecuentes</legend>
          <ol className="list-decimal space-y-0.5 pl-5">
            {s.topSearches.map((q) => (
              <li key={q.display}>
                <Link href={`/search?q=${encodeURIComponent(q.display)}`}>{q.display}</Link> — {q.count} veces · {q.last_results} resultados
              </li>
            ))}
            {!s.topSearches.length && <li className="list-none">Sin datos todavía.</li>}
          </ol>
        </fieldset>

        <fieldset className="win-groupbox">
          <legend>Búsquedas sin resultados (ideas para nuevas fuentes)</legend>
          <ul className="space-y-0.5">
            {s.zeroSearches.map((q) => (
              <li key={q.display}>
                “{q.display}” — {q.count} veces
              </li>
            ))}
            {!s.zeroSearches.length && <li>Ninguna.</li>}
          </ul>
          <p className="mt-2 text-win-dark">Memes por categoría:</p>
          <div className="flex flex-wrap gap-1">
            {s.byCategory.map((c) => (
              <span key={c.category} className="win-chip">
                {CATEGORIES.find((x) => x.slug === c.category)?.es ?? c.category}: {c.n}
              </span>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
