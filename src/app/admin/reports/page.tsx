import Link from "next/link";
import { listReports } from "@/lib/memes/reports";
import { REPORT_REASONS } from "@/lib/memes/taxonomy";
import { storage } from "@/lib/storage";
import { adminSrc } from "../paths";
import { ActionButton, StatusBadge } from "../ui";

export default async function AdminReports({ searchParams }: PageProps<"/admin/reports">) {
  const view = (await searchParams).view === "closed" ? "closed" : "open";
  const reports = await listReports(view);

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <Link href="/admin/reports" className="win-btn win-btn-sm" aria-pressed={view === "open"}>
          Abiertos
        </Link>
        <Link href="/admin/reports?view=closed" className="win-btn win-btn-sm" aria-pressed={view === "closed"}>
          Resueltos
        </Link>
      </div>
      {!reports.length && <p className="p-4 text-center">{view === "open" ? "No hay reportes abiertos." : "Todavía no se resolvió ningún reporte."}</p>}
      <ul className="space-y-2">
        {reports.map((r) => (
          <li key={r.id} className="win-sunken flex flex-col gap-2 p-2 sm:flex-row">
            {r.meme_thumb ? (
              <Link href={`/admin/memes/${r.meme_id}`} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={adminSrc(storage().publicUrl(r.meme_thumb))} alt="" className="h-24 w-24 object-cover" />
              </Link>
            ) : (
              <div className="grid h-24 w-24 shrink-0 place-items-center bg-win-light text-center text-[11px]">sin imagen</div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={r.status} />
                <b>{REPORT_REASONS.find((x) => x.slug === r.reason)?.label ?? r.reason}</b>
                <span className="text-win-dark">· {new Date(r.created_at).toLocaleString("es-AR")}</span>
                {r.is_rights_holder && <span className="win-chip">Titular de derechos</span>}
              </div>
              <p>
                Meme:{" "}
                {r.meme_id ? (
                  <Link href={`/admin/memes/${r.meme_id}`}>
                    {r.meme_title} ({r.meme_status})
                  </Link>
                ) : (
                  <span>{r.target_url ?? "—"} (no coincide con ningún meme)</span>
                )}
              </p>
              {r.details && <p className="whitespace-pre-wrap break-words">{r.details}</p>}
              {(r.reporter_name || r.reporter_email) && (
                <p className="text-win-dark">
                  Denunciante: {r.reporter_name ?? "—"} {r.reporter_email && <a href={`mailto:${r.reporter_email}`}>&lt;{r.reporter_email}&gt;</a>}
                </p>
              )}
              {r.resolution && <p className="text-win-dark">Resolución: {r.resolution}</p>}
              {r.status === "open" && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {r.meme_id && (
                    <>
                      <ActionButton url={`/api/admin/reports/${r.id}`} body={{ action: "hide" }}>
                        Ocultar meme
                      </ActionButton>
                      <ActionButton url={`/api/admin/reports/${r.id}`} body={{ action: "remove" }} confirm="¿Eliminar el archivo del meme? No se podrá volver a importar.">
                        Eliminar meme
                      </ActionButton>
                    </>
                  )}
                  <ActionButton url={`/api/admin/reports/${r.id}`} body={{ action: "dismiss" }}>
                    Desestimar
                  </ActionButton>
                  {r.meme_status === "hidden" && (
                    <ActionButton url={`/api/admin/reports/${r.id}`} body={{ action: "restore" }}>
                      Desestimar y volver a publicar
                    </ActionButton>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
