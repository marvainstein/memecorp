import { config } from "@/lib/config";
import { ADAPTERS } from "@/lib/importers/registry";
import { listSources, recentRuns, sourceProblem } from "@/lib/importers/runner";
import { StatusBadge } from "../ui";
import { SourceCard } from "./SourceCard";

const fmt = (d: string | Date | null) => (d ? new Date(d).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "nunca");

export default async function AdminSources() {
  const [sources, runs] = await Promise.all([listSources(), recentRuns(40)]);

  return (
    <div className="space-y-3">
      <p>
        El catálogo se completa solo: cada fuente corre según su intervalo{" "}
        {config.import.scheduler === "inprocess" ? "dentro del servidor web" : "desde el worker (npm run worker) o el endpoint de cron"}. Las
        solicitudes respetan robots.txt, se espacian por servidor y reintentan con espera exponencial; una fuente que falla 3 veces seguidas se pausa
        sola sin afectar al buscador.
        {config.import.ocr ? " El texto de cada imagen se lee con OCR para que sea buscable." : ""}{" "}
        {config.import.autoPublish ? "Los memes importados se publican al instante." : "Los memes importados quedan pendientes de revisión."}
      </p>

      <div className="grid gap-3 xl:grid-cols-2">
        {sources.map((s) => (
          <SourceCard
            key={s.id}
            source={{
              id: s.id,
              name: s.name,
              adapter: s.adapter,
              adapterLabel: ADAPTERS[s.adapter]?.label ?? s.adapter,
              adapterDescription: ADAPTERS[s.adapter]?.description ?? "",
              enabled: s.enabled,
              intervalMinutes: s.interval_minutes,
              config: s.config,
              problem: sourceProblem(s),
              running: Boolean(s.running_since),
              lastRun: fmt(s.last_run_at),
              lastSuccess: fmt(s.last_success_at),
              pausedUntil: s.paused_until && new Date(s.paused_until) > new Date() ? fmt(s.paused_until) : null,
              failures: s.consecutive_failures,
              lastError: s.last_error,
              total: s.total_imported,
            }}
          />
        ))}
      </div>

      <fieldset className="win-groupbox">
        <legend>Historial de ejecuciones</legend>
        <div className="win-sunken win-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr>
                {["Inicio", "Fuente", "Disparador", "Estado", "Encontrados", "Nuevos", "Repetidos", "Descartados", "Errores", "Detalle"].map((h) => (
                  <th key={h} className="bg-win-gray px-2 py-0.5 font-normal shadow-[var(--bevel-raised)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-win-light align-top">
                  <td className="whitespace-nowrap px-2">{fmt(r.started_at)}</td>
                  <td className="px-2">{r.source_id}</td>
                  <td className="px-2">{r.trigger}</td>
                  <td className="px-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-2 text-right">{r.fetched}</td>
                  <td className="px-2 text-right font-bold">{r.created}</td>
                  <td className="px-2 text-right">{r.duplicates}</td>
                  <td className="px-2 text-right">{r.skipped}</td>
                  <td className="px-2 text-right">{r.failed}</td>
                  <td className="max-w-[320px] truncate px-2 text-win-dark" title={r.message ?? ""}>
                    {r.message}
                  </td>
                </tr>
              ))}
              {!runs.length && (
                <tr>
                  <td colSpan={10} className="p-3 text-center">
                    Sin ejecuciones todavía. La primera corre unos segundos después de iniciar el servidor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </fieldset>
    </div>
  );
}
