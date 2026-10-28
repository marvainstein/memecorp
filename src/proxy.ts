import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_REALM, isAdmin } from "./lib/auth";

/** Basic Auth in front of the admin panel and its API. */
export function proxy(req: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) {
    return new NextResponse("Panel deshabilitado: definí ADMIN_PASSWORD en el entorno.", { status: 503 });
  }
  if (isAdmin(req.headers.get("authorization"))) return NextResponse.next();
  return new NextResponse("Autenticación requerida.", { status: 401, headers: { "WWW-Authenticate": ADMIN_REALM } });
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
