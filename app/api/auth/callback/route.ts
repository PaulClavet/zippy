import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/esi/client";
import { publicOrigin } from "@/lib/esi/config";
import { sessionFromToken, writeSession } from "@/lib/esi/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  // Prefer the configured public origin so redirects work behind a reverse proxy.
  const origin = publicOrigin();

  const store = await cookies();
  const expected = store.get("esi_state")?.value;

  if (!code || !state || state !== expected) {
    return NextResponse.redirect(new URL("/?auth=state-error", origin));
  }

  try {
    const token = await exchangeCode(code);
    await writeSession(sessionFromToken(token));
    store.delete("esi_state");
    return NextResponse.redirect(new URL("/?auth=ok", origin));
  } catch {
    return NextResponse.redirect(new URL("/?auth=error", origin));
  }
}
