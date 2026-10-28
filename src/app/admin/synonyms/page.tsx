import { query } from "@/lib/db";
import { SynonymsForm } from "./SynonymsForm";

export default async function AdminSynonyms() {
  const rows = await query<{ terms: string[] }>("SELECT terms FROM synonym_groups ORDER BY id");
  return (
    <div className="space-y-2">
      <p>
        Una línea por grupo, términos separados por coma. Buscar cualquier término de un grupo encuentra memes con los demás (por ejemplo “jefe”
        → “boss”, “manager”). Se admiten frases de varias palabras. Los cambios se aplican en menos de un minuto.
      </p>
      <SynonymsForm initial={rows.map((r) => r.terms.join(", ")).join("\n")} />
    </div>
  );
}
