import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { getMemeRow, toMeme } from "@/lib/memes/repository";
import { formatBytes } from "@/lib/text";
import { adminSrc } from "../../paths";
import { StatusBadge } from "../../ui";
import { EditMemeForm } from "./EditMemeForm";

export default async function AdminMemePage({ params }: PageProps<"/admin/memes/[id]">) {
  const row = await getMemeRow((await params).id);
  if (!row) notFound();
  const meme = toMeme(row);
  const reports = await query<{ id: string; reason: string; details: string; status: string; created_at: string | Date }>(
    "SELECT id, reason, details, status, created_at FROM reports WHERE meme_id = $1 ORDER BY created_at DESC",
    [meme.id],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/memes" className="win-btn win-btn-sm">
          ← Volver
        </Link>
        <StatusBadge status={meme.status} />
        {meme.statusReason && <span className="text-win-dark">{meme.statusReason}</span>}
        {meme.status === "active" && (
          <Link href={meme.pageUrl} className="ml-auto" target="_blank">
            Ver ficha pública ↗
          </Link>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="win-sunken flex items-center justify-center p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={adminSrc(meme.imageUrl)} alt={meme.altText} className="max-h-[60dvh] max-w-full object-contain" />
          </div>
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-2 gap-y-0.5">
            <dt>ID</dt>
            <dd>{meme.id}</dd>
            <dt>Archivo</dt>
            <dd>
              {meme.format.toUpperCase()} · {meme.width}×{meme.height} · {formatBytes(meme.bytes)}
            </dd>
            <dt>SHA-256</dt>
            <dd className="truncate" title={row.sha256}>
              {row.sha256}
            </dd>
            <dt>Origen</dt>
            <dd className="break-words">
              {meme.sourceUrl ? (
                <a href={meme.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {meme.sourceUrl}
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt>Indexado</dt>
            <dd>{new Date(meme.createdAt).toLocaleString("es-AR")}</dd>
            <dt>Métricas</dt>
            <dd>
              {meme.viewCount} vistas · {meme.downloadCount} descargas · {meme.shareCount} compartidos
            </dd>
          </dl>
          {reports.length > 0 && (
            <fieldset className="win-groupbox">
              <legend>Reportes</legend>
              <ul className="space-y-1">
                {reports.map((r) => (
                  <li key={r.id}>
                    <StatusBadge status={r.status} /> {r.reason} — {r.details || "sin detalles"}{" "}
                    <span className="text-win-dark">({new Date(r.created_at).toLocaleDateString("es-AR")})</span>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
        </div>
        <EditMemeForm meme={meme} />
      </div>
    </div>
  );
}
