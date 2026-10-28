import { runDue } from "./runner";

const TICK_MS = 60_000;
const FIRST_TICK_MS = 20_000;

const g = globalThis as unknown as { __memedeskScheduler?: { timer: ReturnType<typeof setInterval>; busy: boolean } };

/**
 * In-process scheduler: every minute, runs the sources whose interval has elapsed. Safe to start
 * more than once (hot reload) and across processes (sources are locked in the database).
 */
export function startScheduler(log: (msg: string) => void = (m) => console.log(`[import] ${m}`)) {
  if (g.__memedeskScheduler) return;
  const state = { timer: null as unknown as ReturnType<typeof setInterval>, busy: false };
  const tick = async () => {
    if (state.busy) return;
    state.busy = true;
    try {
      for (const r of await runDue({ trigger: "schedule" })) {
        log(`${r.sourceId}: ${r.status} — ${r.created} nuevos, ${r.duplicates} repetidos, ${r.skipped} descartados, ${r.failed} errores`);
      }
    } catch (err) {
      // The search keeps working with what is already indexed; we just try again next tick.
      log(`error del planificador: ${(err as Error).message}`);
    } finally {
      state.busy = false;
    }
  };
  setTimeout(tick, FIRST_TICK_MS);
  state.timer = setInterval(tick, TICK_MS);
  state.timer.unref?.();
  g.__memedeskScheduler = state;
  log("planificador de importación iniciado");
}
