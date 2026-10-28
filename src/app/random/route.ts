import { NextResponse } from "next/server";
import { randomMemeId } from "@/lib/memes/repository";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const id = await randomMemeId();
  return NextResponse.redirect(new URL(id ? `/m/${id}` : "/", req.url), { headers: { "Cache-Control": "no-store" } });
}
