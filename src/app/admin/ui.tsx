"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

/** Button that calls an admin API and refreshes the server-rendered page afterwards. */
export function ActionButton({
  url,
  method = "POST",
  body,
  confirm,
  children,
  className = "win-btn win-btn-sm",
  onDone,
}: {
  url: string;
  method?: "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  confirm?: string;
  children: ReactNode;
  className?: string;
  onDone?: (data: unknown) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          setBusy(true);
          setError(null);
          const res = await fetch(url, {
            method,
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
          }).catch(() => null);
          const data = await res?.json().catch(() => null);
          setBusy(false);
          if (!res?.ok) return setError(data?.message ?? "Error");
          onDone?.(data);
          router.refresh();
        }}
      >
        {busy ? "…" : children}
      </button>
      {error && <span className="win-tooltip ml-1 inline-block">{error}</span>}
    </>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-[#008000] text-white",
    success: "bg-[#008000] text-white",
    pending: "bg-[#ffff00] text-black",
    partial: "bg-[#ffff00] text-black",
    running: "bg-win-blue text-white",
    hidden: "bg-win-dark text-white",
    skipped: "bg-win-light text-black",
    removed: "bg-[#c00000] text-white",
    failed: "bg-[#c00000] text-white",
    rejected: "bg-black text-white",
    open: "bg-[#c00000] text-white",
    dismissed: "bg-win-light text-black",
    actioned: "bg-[#008000] text-white",
  };
  const labels: Record<string, string> = {
    active: "Publicado",
    pending: "Pendiente",
    hidden: "Oculto",
    removed: "Eliminado",
    rejected: "Rechazado",
    success: "OK",
    partial: "Parcial",
    running: "En curso",
    skipped: "Omitida",
    failed: "Falló",
    open: "Abierto",
    dismissed: "Desestimado",
    actioned: "Resuelto",
  };
  return <span className={`inline-block px-1.5 text-[11px] ${styles[status] ?? "bg-win-light"}`}>{labels[status] ?? status}</span>;
}
