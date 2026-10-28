/**
 * Runs import sources from the command line.
 *
 *   npm run import                 # every source that is due
 *   npm run import -- --all        # every enabled source, ignoring intervals
 *   npm run import -- lemmy-work-humor imgflip-templates
 *   npm run import -- --list
 *
 * With the embedded PGlite database, stop `npm run dev` first (only one process can open it).
 */
import { closeDb } from "@/lib/db";
import { listSources, runDue, runSource, sourceProblem } from "@/lib/importers/runner";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    for (const s of await listSources()) {
      const problem = sourceProblem(s);
      console.log(`${s.enabled ? "●" : "○"} ${s.id.padEnd(22)} ${s.adapter.padEnd(10)} cada ${s.interval_minutes} min · ${s.total_imported} importados${problem ? ` · ⚠ ${problem}` : ""}`);
    }
    return;
  }
  const ids = args.filter((a) => !a.startsWith("--"));
  const results = ids.length
    ? await Promise.all(ids.map((id) => runSource(id, "cli")))
    : args.includes("--all")
      ? await Promise.all((await listSources()).filter((s) => s.enabled).map((s) => runSource(s.id, "cli")))
      : await runDue({ trigger: "cli" });
  if (!results.length) console.log("No hay fuentes pendientes. Usá --all para forzar.");
  for (const r of results) {
    console.log(`${r.sourceId}: ${r.status} · ${r.fetched} encontrados · ${r.created} nuevos · ${r.duplicates} repetidos · ${r.skipped} descartados · ${r.failed} errores`);
    if (r.message) console.log(`  ${r.message.replace(/\n/g, "\n  ")}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeDb);
