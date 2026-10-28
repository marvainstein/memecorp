"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBadge } from "../ui";

type SourceView = {
  id: string;
  name: string;
  adapter: string;
  adapterLabel: string;
  adapterDescription: string;
  enabled: boolean;
  intervalMinutes: number;
  config: Record<string, unknown>;
  problem: string | null;
  running: boolean;
  lastRun: string;
  lastSuccess: string;
  pausedUntil: string | null;
  failures: number;
  lastError: string | null;
  total: number;
};

export function SourceCard({ source }: { source: SourceView }) {
  const router = useRouter();
  const [configText, setConfigText] = useState(JSON.stringify(source.config, null, 2));
  const [intervalText, setIntervalText] = useState(String(source.intervalMinutes));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const call = async (method: "PATCH" | "POST", body: unknown, ok: string) => {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/sources/${source.id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    setMessage(res?.ok ? ok : (data?.message ?? "Error"));
    router.refresh();
  };

  const save = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(configText);
    } catch {
      return setMessage("La configuración no es JSON válido.");
    }
    call("PATCH", { config: parsed, intervalMinutes: Number(intervalText) }, "Configuración guardada.");
  };

  const state = !source.enabled ? (
    <StatusBadge status="skipped" />
  ) : source.running ? (
    <StatusBadge status="running" />
  ) : source.problem ? (
    <span className="bg-[#ffff00] px-1.5 text-[11px]">Falta configurar</span>
  ) : source.pausedUntil ? (
    <span className="bg-[#c00000] px-1.5 text-[11px] text-white">En pausa</span>
  ) : (
    <StatusBadge status={source.failures ? "failed" : "active"} />
  );

  return (
    <fieldset className="win-groupbox space-y-2">
      <legend className="flex items-center gap-1.5">
        {source.name} {state}
      </legend>
      <p className="text-win-dark">
        {source.adapterLabel} — {source.adapterDescription}
      </p>
      {source.problem && <p className="bg-win-yellow p-1 shadow-[var(--bevel-thin-sunken)]">⚠ {source.problem}</p>}
      <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-2 gap-y-0.5">
        <dt>Última ejecución</dt>
        <dd>{source.lastRun}</dd>
        <dt>Último éxito</dt>
        <dd>{source.lastSuccess}</dd>
        <dt>Importados</dt>
        <dd>{source.total}</dd>
        {source.pausedUntil && (
          <>
            <dt>Pausada hasta</dt>
            <dd>
              {source.pausedUntil} ({source.failures} fallos seguidos)
            </dd>
          </>
        )}
        {source.lastError && (
          <>
            <dt>Último error</dt>
            <dd className="whitespace-pre-wrap break-words text-[#c00000]">{source.lastError}</dd>
          </>
        )}
      </dl>
      <details>
        <summary className="cursor-pointer">Configuración</summary>
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-2">
            Correr cada
            <input type="number" min={15} step={15} value={intervalText} onChange={(e) => setIntervalText(e.target.value)} className="win-field w-24" />
            minutos
          </label>
          <textarea value={configText} onChange={(e) => setConfigText(e.target.value)} className="win-field font-win-mono text-[12px]" rows={10} spellCheck={false} />
          <button type="button" className="win-btn" onClick={save} disabled={busy}>
            Guardar configuración
          </button>
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className="win-btn win-btn-default" disabled={busy || source.running || !!source.problem} onClick={() => call("POST", { action: "run" }, "Importación iniciada: recargá en unos minutos.")}>
          Ejecutar ahora
        </button>
        <button type="button" className="win-btn" disabled={busy} onClick={() => call("PATCH", { enabled: !source.enabled }, source.enabled ? "Fuente desactivada." : "Fuente activada.")}>
          {source.enabled ? "Desactivar" : "Activar"}
        </button>
        {(source.pausedUntil || source.failures > 0) && (
          <button type="button" className="win-btn" disabled={busy} onClick={() => call("PATCH", { resetPause: true }, "Pausa eliminada.")}>
            Quitar pausa
          </button>
        )}
        {message && <span className="win-tooltip">{message}</span>}
      </div>
    </fieldset>
  );
}
