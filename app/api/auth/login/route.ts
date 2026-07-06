import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ESI_SCOPES, SSO_AUTHORIZE, callbackUrl, clientId, ssoConfigured } from "@/lib/esi/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!ssoConfigured()) {
    return NextResponse.json(
      { error: "EVE SSO not configured. Set EVE_CLIENT_ID and EVE_CLIENT_SECRET." },
      { status: 501 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const url = new URL(SSO_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("scope", ESI_SCOPES.join(" "));
  url.searchParams.set("state", state);

  const store = await cookies();
  store.set("esi_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(url.toString());
}
