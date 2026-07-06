import { type NextRequest, NextResponse } from "next/server";
import { EsiAuthError, setWaypoints } from "@/lib/esi/client";
import { getValidSession } from "@/lib/esi/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getValidSession();
  if (!session) return NextResponse.json({ error: "not-signed-in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const systemIds: number[] = Array.isArray(body.systemIds)
    ? body.systemIds.filter((n: unknown): n is number => Number.isInteger(n))
    : [];
  if (systemIds.length === 0) {
    return NextResponse.json({ error: "systemIds is required" }, { status: 400 });
  }

  try {
    const set = await setWaypoints(session.access, systemIds);
    return NextResponse.json({ set });
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
