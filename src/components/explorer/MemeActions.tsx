"use client";

import { useEffect, useRef, useState } from "react";
import type { Meme } from "@/lib/memes/types";
import { Dialog } from "../win95/Dialog";
import { DownloadIcon, FlagIcon, ImageIcon, InfoIcon, LinkIcon, ShareIcon } from "../win95/Icons";
import { ReportDialog } from "./ReportDialog";

const absolute = (path: string) => new URL(path, window.location.origin).toString();

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/** Clipboard only reliably accepts PNG, so other formats are converted through a canvas. */
async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}

const trackShare = (id: string) => fetch(`/api/memes/${id}/share`, { method: "POST", keepalive: true }).catch(() => {});

export function MemeActions({ meme, compact = false }: { meme: Meme; compact?: boolean }) {
  const [toast, setToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const fileRef = useRef<File | null>(null);
  const filename = `${meme.slug}-memecorp.${meme.format}`;

  // Fetch the image ahead of time: mobile browsers only allow navigator.share right after a tap,
  // and waiting for a download first would lose that permission.
  useEffect(() => {
    fileRef.current = null;
    if (typeof navigator.canShare !== "function") return;
    let cancelled = false;
    fetch(meme.imageUrl)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((blob) => {
        if (!cancelled) fileRef.current = new File([blob], filename, { type: blob.type || meme.mime });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meme.imageUrl, meme.mime, filename]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const pageUrl = () => absolute(meme.pageUrl);

  const share = async () => {
    const file = fileRef.current;
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: meme.title, text: meme.title });
        trackShare(meme.id);
        return;
      }
      if (typeof navigator.share === "function") {
        await navigator.share({ title: meme.title, text: meme.title, url: pageUrl() });
        trackShare(meme.id);
        return;
      }
    } catch (err) {
      if ((err as DOMException).name === "AbortError") return;
    }
    setShareOpen(true);
  };

  const copyLink = async () => setToast((await copyText(pageUrl())) ? "Enlace copiado al portapapeles." : "No se pudo copiar el enlace.");

  const copyImage = async () => {
    try {
      const png = fetch(meme.imageUrl).then((r) => r.blob()).then(toPng);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setToast("Imagen copiada. Pegala en tu chat con Ctrl+V.");
      trackShare(meme.id);
    } catch {
      setToast("Tu navegador no permite copiar imágenes. Descargala o copiá el enlace.");
    }
  };

  const shareText = encodeURIComponent(`${meme.title} — vía MemeCorp`);

  return (
    <>
      <div className={`flex flex-wrap gap-1.5 ${compact ? "" : "sm:gap-2"}`}>
        <a href={`/api/memes/${meme.id}/download`} className="win-btn win-btn-default" download={filename} onClick={() => setToast("Descargando el archivo original…")}>
          <DownloadIcon /> Descargar
        </a>
        <button type="button" className="win-btn" onClick={share}>
          <ShareIcon /> Compartir…
        </button>
        <button type="button" className="win-btn" onClick={copyLink}>
          <LinkIcon /> Copiar enlace
        </button>
        <button type="button" className="win-btn hidden sm:inline-flex" onClick={copyImage}>
          <ImageIcon /> Copiar imagen
        </button>
        <button type="button" className="win-btn" onClick={() => setReportOpen(true)}>
          <FlagIcon /> Reportar
        </button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 pt-1">
        {toast && <span className="win-tooltip inline-block">{toast}</span>}
      </p>

      <Dialog open={shareOpen} onClose={() => setShareOpen(false)} title="Compartir meme" icon={<ShareIcon />}>
        <div className="flex gap-3">
          <InfoIcon />
          <p>
            Tu navegador no puede adjuntar la imagen directamente. Compartí el enlace (WhatsApp y Telegram muestran la vista previa del meme) o
            descargá el archivo y adjuntalo a mano.
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a className="win-btn" href={`https://wa.me/?text=${shareText}%20${encodeURIComponent(pageUrl())}`} target="_blank" rel="noopener noreferrer" onClick={() => trackShare(meme.id)}>
            WhatsApp
          </a>
          <a
            className="win-btn"
            href={`https://t.me/share/url?url=${encodeURIComponent(pageUrl())}&text=${shareText}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackShare(meme.id)}
          >
            Telegram
          </a>
          <a className="win-btn" href={`https://x.com/intent/post?text=${shareText}&url=${encodeURIComponent(pageUrl())}`} target="_blank" rel="noopener noreferrer" onClick={() => trackShare(meme.id)}>
            X / Twitter
          </a>
          <a className="win-btn" href={`mailto:?subject=${shareText}&body=${encodeURIComponent(pageUrl())}`} onClick={() => trackShare(meme.id)}>
            Correo
          </a>
          <button type="button" className="win-btn" onClick={copyLink}>
            <LinkIcon /> Copiar enlace
          </button>
          <button type="button" className="win-btn" onClick={copyImage}>
            <ImageIcon /> Copiar imagen
          </button>
          <a href={`/api/memes/${meme.id}/download`} className="win-btn col-span-2" download={filename}>
            <DownloadIcon /> Descargar archivo original
          </a>
        </div>
        <div className="mt-2 min-h-5">{toast && <span className="win-tooltip inline-block">{toast}</span>}</div>
        <div className="mt-2 flex justify-end">
          <button type="button" className="win-btn" onClick={() => setShareOpen(false)}>
            Cerrar
          </button>
        </div>
      </Dialog>

      <ReportDialog memeId={meme.id} memeTitle={meme.title} open={reportOpen} onClose={() => setReportOpen(false)} />
    </>
  );
}
