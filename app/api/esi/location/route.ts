import { NextResponse } from "next/server";
import { EsiAuthError, getLocation } from "@/lib/esi/client";
import { getValidSession } from "@/lib/esi/session";
import { loadBaseStarMap } from "@/lib/sde/loader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getValidSession();
  if (!session) return NextResponse.json({ error: "not-signed-in" }, { status: 401 });

  try {
    const loc = await getLocation(session.access, session.characterId);
    const system = loadBaseStarMap().systems.get(loc.solar_system_id);
    return NextResponse.json({
      systemId: loc.solar_system_id,
      systemName: system?.name ?? String(loc.solar_system_id),
    });
  } catch (err) {
    if (err instanceof EsiAuthError) {
      return NextResponse.json({ error: "esi-forbidden", message: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: "esi-failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
