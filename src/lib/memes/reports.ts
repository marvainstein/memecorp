import crypto from "node:crypto";
import { config } from "../config";
import { query } from "../db";
import { clampText } from "../text";
import { cleanUrl, getMemeRow, removeMeme, setStatus } from "./repository";
import { newId } from "./ingest";
import { REPORT_REASONS } from "./taxonomy";

export { REPORT_REASONS };

export type ReportReason = (typeof REPORT_REASONS)[number]["slug"];

export type ReportInput = {
  memeId?: string | null;
  targetUrl?: string | null;
  reason: string;
  details?: string;
  reporterName?: string;
  reporterEmail?: string;
  isRightsHolder?: boolean;
  ip?: string | null;
};

export type ReportRow = {
  id: string;
  meme_id: string | null;
  target_url: string | null;
  reason: ReportReason;
  details: string;
  reporter_name: string | null;
  reporter_email: string | null;
  is_rights_holder: boolean;
  status: "open" | "dismissed" | "actioned";
  resolution: string | null;
  created_at: string | Date;
  resolved_at: string | Date | null;
};

const hashIp = (ip: string) =>
  crypto.createHash("sha256").update(`memedesk:${ip}:${process.env.ADMIN_PASSWORD ?? ""}`).digest("hex").slice(0, 24);

/** Extracts a meme id from a pasted MemeDesk link like https://site/m/abc123 or /files/originals/abc123.png. */
export function memeIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/m\/([A-Za-z0-9]{6,20})/) ?? url.match(/\/(?:originals|thumbs)\/([A-Za-z0-9]{6,20})\./);
  return m?.[1] ?? null;
}

export async function createReport(input: ReportInput) {
  const reason = REPORT_REASONS.some((r) => r.slug === input.reason) ? (input.reason as ReportReason) : null;
  if (!reason) return { ok: false as const, message: "Elegí un motivo válido." };

  const targetUrl = cleanUrl(input.targetUrl);
  const memeId = input.memeId || memeIdFromUrl(targetUrl);
  const meme = memeId ? await getMemeRow(memeId) : null;
  if (!meme && !targetUrl) return { ok: false as const, message: "Indicá el meme o la URL a reportar." };

  const email = clampText(input.reporterEmail, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, message: "El email no es válido." };
  if (reason === "copyright" && (!email || clampText(input.details, 5000).length < 10)) {
    return {
      ok: false as const,
      message: "Para un reclamo de derechos de autor necesitamos un email de contacto y una breve descripción de la obra.",
    };
  }

  const id = newId();
  await query(
    `INSERT INTO reports (id, meme_id, target_url, reason, details, reporter_name, reporter_email, is_rights_holder, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      meme?.id ?? null,
      targetUrl,
      reason,
      clampText(input.details, 5000),
      clampText(input.reporterName, 160) || null,
      email || null,
      Boolean(input.isRightsHolder),
      input.ip ? hashIp(input.ip) : null,
    ],
  );

  // Notice-and-takedown safety valve: enough distinct open reports hide the meme until an admin reviews it.
  let autoHidden = false;
  if (meme && meme.status === "active" && config.reportAutohideThreshold > 0) {
    const [{ n }] = await query<{ n: number }>(
      `SELECT count(DISTINCT coalesce(ip_hash, id))::int AS n FROM reports WHERE meme_id = $1 AND status = 'open'`,
      [meme.id],
    );
    if (n >= config.reportAutohideThreshold) {
      await setStatus(meme.id, "hidden", `Oculto automáticamente: ${n} reportes abiertos`);
      autoHidden = true;
    }
  }
  return { ok: true as const, id, autoHidden };
}

export async function listReports(status: "open" | "closed" = "open", limit = 100) {
  return query<ReportRow & { meme_title: string | null; meme_status: string | null; meme_thumb: string | null }>(
    `SELECT r.*, m.title AS meme_title, m.status AS meme_status, m.thumb_key AS meme_thumb
     FROM reports r LEFT JOIN memes m ON m.id = r.meme_id
     WHERE ${status === "open" ? "r.status = 'open'" : "r.status <> 'open'"}
     ORDER BY r.created_at DESC LIMIT $1`,
    [limit],
  );
}

export type ReportAction = "hide" | "remove" | "dismiss" | "restore";

/** Resolves a report; `hide`/`remove` act on the meme and close every open report for it. */
export async function resolveReport(id: string, action: ReportAction, note?: string) {
  const [report] = await query<ReportRow>("SELECT * FROM reports WHERE id = $1", [id]);
  if (!report) return null;
  const resolution = clampText(note, 500) || null;

  if (action === "dismiss" || action === "restore") {
    await query(`UPDATE reports SET status = 'dismissed', resolution = $2, resolved_at = now() WHERE id = $1`, [id, resolution]);
    if (action === "restore" && report.meme_id) await setStatus(report.meme_id, "active", null);
    return { ok: true };
  }
  if (!report.meme_id) {
    await query(`UPDATE reports SET status = 'actioned', resolution = $2, resolved_at = now() WHERE id = $1`, [id, resolution]);
    return { ok: true };
  }
  const reason = `Reporte ${report.reason}${resolution ? `: ${resolution}` : ""}`;
  if (action === "hide") await setStatus(report.meme_id, "hidden", reason);
  else await removeMeme(report.meme_id, reason);
  await query(
    `UPDATE reports SET status = 'actioned', resolution = $2, resolved_at = now() WHERE meme_id = $1 AND status = 'open'`,
    [report.meme_id, resolution ?? action],
  );
  return { ok: true };
}
