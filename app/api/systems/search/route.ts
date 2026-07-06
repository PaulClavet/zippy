import { type NextRequest, NextResponse } from "next/server";
import { securityBand } from "@/lib/graph/types";
import { loadBaseStarMap } from "@/lib/sde/loader";
import { searchSystems } from "@/lib/sde/lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const map = loadBaseStarMap();
  const systems = searchSystems(map, q, 15).map((s) => ({
    id: s.id,
    name: s.name,
    security: s.security,
    band: securityBand(s),
    regionName: s.regionName,
  }));
  return NextResponse.json({ systems });
}
