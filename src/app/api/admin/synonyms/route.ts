import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { error, json } from "@/lib/http";
import { invalidateSynonyms } from "@/lib/search";
import { parseList } from "@/lib/text";

/** Replaces every synonym group with the posted text (one group per line, comma-separated terms). */
export async function PUT(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (typeof body?.text !== "string") return error("Falta el texto.");
  const groups = body.text
    .split(/\r?\n/)
    .map((line: string) => parseList(line, 60))
    .filter((g: string[]) => g.length >= 2)
    .slice(0, 2000);

  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.query("DELETE FROM synonym_groups");
    for (const terms of groups) await tx.query("INSERT INTO synonym_groups (terms) VALUES ($1)", [terms]);
  });
  invalidateSynonyms();
  return json({ ok: true, groups: groups.length });
}
