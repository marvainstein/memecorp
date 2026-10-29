import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { config } from "../config";

/**
 * Local OCR (tesseract.js, Spanish + English) to index the text printed on memes, which is
 * usually where the joke is. Language data ships with npm packages; nothing is downloaded at runtime.
 */
type OcrWorker = { recognize: (img: Buffer) => Promise<{ data: { text: string; confidence: number } }>; terminate: () => Promise<unknown> };

const IDLE_MS = 2 * 60_000;
const g = globalThis as unknown as { __memecorpOcr?: { worker: Promise<OcrWorker>; idle?: ReturnType<typeof setTimeout> } };

function langDir() {
  const dir = path.join(config.dataDir, "tessdata");
  fs.mkdirSync(dir, { recursive: true });
  for (const lang of ["spa", "eng"]) {
    const target = path.join(dir, `${lang}.traineddata.gz`);
    if (!fs.existsSync(target)) {
      const source = path.join(process.cwd(), "node_modules", "@tesseract.js-data", lang, "4.0.0_best_int", `${lang}.traineddata.gz`);
      fs.copyFileSync(source, target);
    }
  }
  return dir;
}

async function worker(): Promise<OcrWorker> {
  if (!g.__memecorpOcr) {
    const dir = langDir();
    const created = import("tesseract.js").then(async ({ createWorker }) => {
      const w = await createWorker(["spa", "eng"], 1, { langPath: dir, cachePath: dir, gzip: true });
      await w.setParameters({ user_defined_dpi: "150" }); // web images carry no DPI; avoids noisy warnings
      return w as unknown as OcrWorker;
    });
    g.__memecorpOcr = { worker: created };
    created.catch(() => (g.__memecorpOcr = undefined));
  }
  const state = g.__memecorpOcr;
  if (state.idle) clearTimeout(state.idle);
  // Free the WASM worker's memory when imports are idle.
  state.idle = setTimeout(async () => {
    if (g.__memecorpOcr === state) g.__memecorpOcr = undefined;
    (await state.worker).terminate().catch(() => {});
  }, IDLE_MS);
  state.idle.unref?.();
  return state.worker;
}

/** Keeps lines that look like words, dropping the noise OCR produces on drawings and photos. */
export function cleanOcrText(text: string): string {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/[|_~=<>{}[\]\\^`/]+/g, " ").replace(/\s+/g, " ").trim())
    .filter((l) => {
      const letters = (l.match(/\p{L}/gu) ?? []).length;
      const words = l.split(" ").filter((w) => /\p{L}{2,}/u.test(w));
      return letters >= 4 && letters / l.length > 0.6 && words.length >= 1;
    })
    .join(" ")
    .slice(0, 2000);
}

export async function ocrImage(buffer: Buffer): Promise<string> {
  if (!config.import.ocr) return "";
  try {
    const base = sharp(buffer).rotate().flatten({ background: "#ffffff" }).grayscale().resize({ width: 1400, withoutEnlargement: true });
    const w = await worker();
    // Pass 1: threshold + invert isolates classic white Impact captions (and still reads dark-on-light text).
    let best = (await w.recognize(await base.clone().threshold(200).negate().png().toBuffer())).data;
    if (best.confidence < 70) {
      const plain = (await w.recognize(await base.clone().normalize().png().toBuffer())).data;
      if (plain.confidence > best.confidence) best = plain;
    }
    return best.confidence < 40 ? "" : cleanOcrText(best.text);
  } catch {
    return ""; // OCR is best-effort; never block an import on it
  }
}
