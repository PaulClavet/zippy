import { type NextRequest, NextResponse } from "next/server";
import { applyWormholes, cloneStarMap } from "@/lib/graph/build";
import { recordAndIdle } from "@/lib/eve/tracking-cache";
import { distancesFrom } from "@/lib/graph/pathfinder";
import { fetchTripwire, tripwireOccupants, TripwireLoginError } from "@/lib/mappers/tripwire";
import { withTripwireSession } from "@/lib/mappers/tripwire-session";
import { loadBaseStarMap } from "@/lib/sde/loader";
import { resolveSystem } from "@/lib/sde/lookup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cap on how many occupied systems we pull occupants for (limits load on Tripwire). */
const MAX_SYSTEMS = 50;

export async function GET(req: NextRequest) {
  const focusRef = req.nextUrl.searchParams.get("focus");
  if (!focusRef) {
    return NextResponse.json({ error: "focus system is required" }, { status: 400 });
  }

  const base = loadBaseStarMap();
  const focusId = resolveSystem(base, focusRef);
  if (focusId == null) {
    return NextResponse.json({ error: `Unknown system: "${focusRef}"` }, { status: 400 });
  }

  try {
    const result = await withTripwireSession(async (baseUrl, cookie) => {
      const chain = await fetchTripwire(baseUrl, cookie, focusId);

      // Layer the live chain onto the gate map, then measure distance to everyone.
      const map = chain.links.length ? cloneStarMap(base) : base;
      if (chain.links.length) applyWormholes(map, chain.links);
      const dist = distancesFrom(map, focusId);

      // Occupied systems reachable through the chain, nearest first, capped.
      const reachable = (chain.occupied ?? [])
        .map((o) => ({ systemID: o.systemID, jumps: dist.get(o.systemID) }))
        .filter((o): o is { systemID: number; jumps: number } => o.jumps != null)
        .sort((a, b) => a.jumps - b.jumps);
      const truncated = reachable.length > MAX_SYSTEMS;
      const systems = reachable.slice(0, MAX_SYSTEMS);

      const perSystem = await Promise.all(
        systems.map(async ({ systemID, jumps }) => {
          const occupants = await tripwireOccupants(baseUrl, cookie, systemID);
          const sys = map.systems.get(systemID);
          return occupants.map((p) => ({
            name: p.name,
            ship: p.ship,
            systemId: systemID,
            systemName: sys?.name ?? String(systemID),
            jumps,
          }));
        }),
      );

      const flat = perSystem.flat();
      const idle = recordAndIdle(
        flat.map((p) => ({ name: p.name, systemId: p.systemId })),
        Date.now(),
      );
      const pilots = flat
        .map((p) => ({ ...p, idleMinutes: idle.get(p.name) ?? 0 }))
        .sort((a, b) => a.jumps - b.jumps || a.name.localeCompare(b.name));

      return {
        focusSystemId: focusId,
        focusName: base.systems.get(focusId)?.name ?? String(focusId),
        pilots,
        count: pilots.length,
        truncated,
        generatedAt: new Date().toISOString(),
      };
    });

    if (result === null) {
      return NextResponse.json({ error: "not-connected" }, { status: 401 });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof TripwireLoginError) {
      return NextResponse.json({ error: "tripwire-login", message: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "tracking-failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
