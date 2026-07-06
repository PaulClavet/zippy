import { NextResponse } from "next/server";
import { ssoConfigured } from "@/lib/esi/config";
import { sdeMeta } from "@/lib/sde/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ sso: ssoConfigured(), sde: sdeMeta() });
}
