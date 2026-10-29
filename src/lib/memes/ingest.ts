import crypto from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { customAlphabet } from "nanoid";
import { config } from "../config";
import { query } from "../db";
import { storage } from "../storage";
import { titleFromFilename } from "../text";
import { MEME_COLUMNS, sanitizeInput, toMeme, type MemeRow } from "./repository";
import { taxonomyKeywords } from "./taxonomy";
import type { Meme, MemeInput, MemeOrigin } from "./types";

export const newId = customAlphabet("23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 10);

const FORMATS: Record<string, { ext: string; mime: string }> = {
  jpeg: { ext: "jpg", mime: "image/jpeg" },
  png: { ext: "png", mime: "image/png" },
  webp: { ext: "webp", mime: "image/webp" },
};

/** Perceptual-hash distance (in bits, out of 256) under which two images count as the same meme. */
export const NEAR_DUPLICATE_BITS = 16;

export type IngestOptions = {
  buffer: Buffer;
  filename?: string;
  meta: MemeInput;
  origin: MemeOrigin;
  /** Re-encode to drop EXIF/GPS metadata. */
  stripMetadata?: boolean;
  /** Skip the perceptual / source-URL duplicate checks (exact SHA-256 duplicates are always rejected). */
  allowSimilar?: boolean;
};

export type IngestResult =
  | { ok: true; meme: Meme }
  | {
      ok: false;
      code: "too-large" | "invalid" | "animated" | "duplicate" | "similar" | "blocked";
      message: string;
      existingId?: string;
    };

/**
 * 256-bit difference hash (16×16 gradients), stored as bit(256). A 64-bit hash is too coarse
 * for memes: the same template with a different caption would look identical.
 */
export async function dHash(buffer: Buffer): Promise<string> {
  const { data } = await sharp(buffer).rotate().grayscale().resize(17, 16, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) bits += data[y * 17 + x] > data[y * 17 + x + 1] ? "1" : "0";
  }
  return bits;
}

export async function ingestImage(opts: IngestOptions): Promise<IngestResult> {
  if (opts.buffer.byteLength > config.maxUploadBytes) {
    return { ok: false, code: "too-large", message: `El archivo supera ${Math.round(config.maxUploadBytes / 1048576)} MB.` };
  }

  let meta: Metadata;
  try {
    meta = await sharp(opts.buffer, { animated: true }).metadata();
  } catch {
    return { ok: false, code: "invalid", message: "No es una imagen válida." };
  }
  if ((meta.pages ?? 1) > 1) {
    return { ok: false, code: "animated", message: "MemeCorp solo admite imágenes estáticas (sin animación)." };
  }

  let buffer = opts.buffer;
  let format: string | undefined = meta.format === "gif" ? "png" : meta.format; // a single-frame GIF becomes PNG
  if (!format || !FORMATS[format]) {
    return { ok: false, code: "invalid", message: "Formato no soportado. Usá JPG, PNG o WebP." };
  }
  if (opts.stripMetadata || meta.format === "gif") {
    const pipeline = sharp(opts.buffer).rotate();
    buffer =
      format === "jpeg"
        ? await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer()
        : format === "webp"
          ? await pipeline.webp({ quality: 92 }).toBuffer()
          : await pipeline.png({ compressionLevel: 9 }).toBuffer();
    meta = await sharp(buffer).metadata();
  }

  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const [exact] = await query<{ id: string; status: string }>("SELECT id, status FROM memes WHERE sha256 = $1", [sha256]);
  if (exact) {
    return exact.status === "removed"
      ? { ok: false, code: "blocked", message: "Esta imagen fue retirada tras una solicitud de retirada.", existingId: exact.id }
      : { ok: false, code: "duplicate", message: "Esta imagen ya está en el catálogo.", existingId: exact.id };
  }

  const phash = await dHash(buffer);
  const [similar] = await query<{ id: string; status: string }>(
    `SELECT id, status FROM memes WHERE phash IS NOT NULL AND bit_count(phash # $1::bit(256)) <= $2
     ORDER BY status = 'removed' DESC LIMIT 1`,
    [phash, NEAR_DUPLICATE_BITS],
  );
  if (similar?.status === "removed") {
    return { ok: false, code: "blocked", message: "Una imagen casi idéntica fue retirada del catálogo.", existingId: similar.id };
  }
  if (similar && !opts.allowSimilar) {
    return { ok: false, code: "similar", message: "Ya existe una imagen muy parecida.", existingId: similar.id };
  }
  const values = sanitizeInput({ ...opts.meta, title: opts.meta.title || titleFromFilename(opts.filename ?? "") });
  if (values.source_url && !opts.allowSimilar) {
    const [sameSource] = await query<{ id: string }>(
      "SELECT id FROM memes WHERE source_url = $1 AND status <> 'removed' LIMIT 1",
      [values.source_url],
    );
    if (sameSource) {
      return { ok: false, code: "similar", message: "Ya hay un meme importado desde esa URL.", existingId: sameSource.id };
    }
  }

  const { ext, mime } = FORMATS[format];
  const orientation = meta.orientation ?? 1;
  const [width, height] = orientation >= 5 ? [meta.height!, meta.width!] : [meta.width!, meta.height!];
  const id = newId();
  const storageKey = `originals/${id}.${ext}`;
  const thumbKey = `thumbs/${id}.webp`;

  const thumb = await sharp(buffer).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  const { dominant } = await sharp(thumb).stats();
  const dominantColor = `#${[dominant.r, dominant.g, dominant.b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;

  const s = storage();
  await s.put(storageKey, buffer, mime);
  await s.put(thumbKey, thumb, "image/webp");

  const categories = (values.categories as string[]) ?? [];
  const row = {
    ...values,
    id,
    origin: opts.origin,
    storage_key: storageKey,
    thumb_key: thumbKey,
    mime,
    format: ext,
    width,
    height,
    bytes: buffer.byteLength,
    sha256,
    phash,
    dominant_color: dominantColor,
    keywords: taxonomyKeywords(categories),
    status: values.status ?? "active",
  };
  const cols = Object.keys(row);
  try {
    const [inserted] = await query<MemeRow>(
      `INSERT INTO memes (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING ${MEME_COLUMNS}`,
      cols.map((c) => (row as Record<string, unknown>)[c]),
    );
    return { ok: true, meme: toMeme(inserted) };
  } catch (err) {
    await Promise.all([s.delete(storageKey), s.delete(thumbKey)]);
    // Two concurrent uploads of the same file: the unique index on sha256 decides the winner.
    if ((err as { code?: string }).code === "23505") {
      return { ok: false, code: "duplicate", message: "Esta imagen ya está en el catálogo." };
    }
    throw err;
  }
}
