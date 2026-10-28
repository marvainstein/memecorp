import Link from "next/link";
import { listForAdmin } from "@/lib/memes/repository";
import { formatBytes } from "@/lib/text";
import { adminSrc } from "../paths";
import { ActionButton, StatusBadge } from "../ui";

const STATUSES = [
  ["all", "Todos"],
  ["active", "Publicados"],
  ["pending", "Pendientes"],
  ["hidden", "Ocultos"],
  ["removed", "Eliminados"],
] as const;

const PAGE = 50;

export default async function AdminMemes({ searchParams }: PageProps<"/admin/memes">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "all";
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listForAdmin({ q, status, limit: PAGE, offset: (page - 1) * PAGE });
  const qs = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams({ status, q, page: String(page), ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) });
    return `/admin/memes?${p}`;
  };

  return (
    <div className="space-y-2">
      <form className="flex flex-wrap items-center gap-1.5" action="/admin/memes">
        <input type="hidden" name="status" value={status} />
        <input name="q" defaultValue={q} className="win-field max-w-xs" placeholder="Buscar por título, etiqueta o ID" />
        <button className="win-btn">Buscar</button>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map(([s, label]) => (
            <Link key={s} href={qs({ status: s, page: 1 })} className="win-btn win-btn-sm" aria-pressed={status === s}>
              {label}
            </Link>
          ))}
        </div>
        <span className="ml-auto">{total.toLocaleString("es-AR")} memes</span>
      </form>

      <div className="win-sunken win-scroll overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr>
              {["", "Título", "Estado", "Origen", "Archivo", "Reportes", "Descargas", "Acciones"].map((h) => (
                <th key={h} className="bg-win-gray px-2 py-0.5 font-normal shadow-[var(--bevel-raised)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b border-win-light align-middle hover:bg-[#e8e8ff]">
                <td className="p-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={adminSrc(m.thumbUrl)} alt="" width={48} height={48} loading="lazy" className="h-12 w-12 object-cover" />
                </td>
                <td className="max-w-[320px] px-2">
                  <Link href={`/admin/memes/${m.id}`} className="line-clamp-2">
                    {m.title}
                  </Link>
                  <span className="text-[11px] text-win-dark">{m.id}</span>
                </td>
                <td className="px-2">
                  <StatusBadge status={m.status} />
                  {m.statusReason && <div className="max-w-[180px] truncate text-[11px] text-win-dark" title={m.statusReason}>{m.statusReason}</div>}
                </td>
                <td className="max-w-[160px] truncate px-2" title={m.sourceUrl ?? ""}>
                  {m.sourceUrl ? (
                    <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {m.sourceName ?? "origen"}
                    </a>
                  ) : (
                    m.sourceName ?? "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-2">
                  {m.format.toUpperCase()} · {formatBytes(m.bytes)}
                </td>
                <td className="px-2 text-center">{m.openReports ? <span className="font-bold text-[#c00000]">{m.openReports}</span> : 0}</td>
                <td className="px-2 text-right">{m.downloadCount}</td>
                <td className="whitespace-nowrap px-2">
                  <div className="flex gap-1">
                    {m.status !== "active" && m.status !== "removed" && (
                      <ActionButton url={`/api/admin/memes/${m.id}`} method="PATCH" body={{ status: "active" }}>
                        Publicar
                      </ActionButton>
                    )}
                    {m.status === "active" && (
                      <ActionButton url={`/api/admin/memes/${m.id}`} method="PATCH" body={{ status: "hidden", statusReason: "Oculto por un administrador" }}>
                        Ocultar
                      </ActionButton>
                    )}
                    {m.status !== "removed" && (
                      <ActionButton url={`/api/admin/memes/${m.id}`} method="DELETE" confirm="¿Eliminar el archivo? Su huella queda bloqueada para que no se vuelva a importar.">
                        Eliminar
                      </ActionButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={8} className="p-4 text-center">
                  No hay memes con este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        {page > 1 && (
          <Link className="win-btn win-btn-sm" href={qs({ page: page - 1 })}>
            ← Anterior
          </Link>
        )}
        <span>
          Página {page} de {Math.max(1, Math.ceil(total / PAGE))}
        </span>
        {page * PAGE < total && (
          <Link className="win-btn win-btn-sm" href={qs({ page: page + 1 })}>
            Siguiente →
          </Link>
        )}
      </div>
    </div>
  );
}
