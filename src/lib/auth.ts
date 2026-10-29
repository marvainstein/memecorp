/** HTTP Basic Auth check for the admin area. Runtime-agnostic (used by proxy.ts and route handlers). */
export const ADMIN_REALM = 'Basic realm="MemeCorp Admin", charset="UTF-8"';

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAdmin(authorization: string | null | undefined): boolean {
  const user = process.env.ADMIN_USER || "admin";
  const password = process.env.ADMIN_PASSWORD || "";
  if (!password || !authorization?.startsWith("Basic ")) return false;
  try {
    const bytes = Uint8Array.from(atob(authorization.slice(6)), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const idx = decoded.indexOf(":");
    return idx >= 0 && safeEqual(decoded.slice(0, idx), user) && safeEqual(decoded.slice(idx + 1), password);
  } catch {
    return false;
  }
}

/** Defense in depth for API handlers: returns a 401 response when the request is not an admin's. */
export function requireAdmin(req: Request): Response | null {
  if (isAdmin(req.headers.get("authorization"))) return null;
  return new Response(JSON.stringify({ ok: false, message: "Autenticación requerida." }), {
    status: 401,
    headers: { "WWW-Authenticate": ADMIN_REALM, "Content-Type": "application/json" },
  });
}
