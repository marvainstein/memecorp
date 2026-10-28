import { NextResponse } from "next/server";

export const json = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);

export const error = (message: string, status = 400, extra?: Record<string, unknown>) =>
  NextResponse.json({ ok: false, message, ...extra }, { status });

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

const buckets = new Map<string, { count: number; reset: number }>();

/**
 * Fixed-window in-memory rate limiter. Good enough for a single instance; put a shared
 * store (Redis, Upstash) behind this function if the app runs on several instances.
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
    }
    return true;
  }
  bucket.count++;
  return bucket.count <= max;
}

/** Reads a multipart field as a trimmed string. */
export const field = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
};

export const fields = (form: FormData, name: string) =>
  form.getAll(name).filter((v): v is string => typeof v === "string").flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
