import { describe, expect, it } from "vitest";
import { buildStarMap, type WormholeLink } from "../graph/build";
import type { SolarSystem, SystemId } from "../graph/types";
import { ZARZAKH_SYSTEM_ID } from "./constants";
import { planRouteOn } from "./planner";

const sys = (id: number, name: string, security: number, regionId?: number): SolarSystem => ({
  id,
  name,
  security,
  regionId,
});

// A -gate- B -gate- C -gate- D  (3 jumps)
// A -gate- Zarzakh -gate- D     (2 jumps, but Zarzakh is auto-avoided)
const systems: SolarSystem[] = [
  sys(1, "Alpha", 0.9, 10),
  sys(2, "Bravo", 0.9, 20),
  sys(3, "Charlie", 0.9, 10),
  sys(4, "Delta", 0.9, 10),
  sys(ZARZAKH_SYSTEM_ID, "Zarzakh", -1.0, 99),
  sys(31001000, "J100000", -1.0, 11),
];
const gates: Array<[SystemId, SystemId]> = [
  [1, 2],
  [2, 3],
  [3, 4],
  [1, ZARZAKH_SYSTEM_ID],
  [ZARZAKH_SYSTEM_ID, 4],
];
const map = buildStarMap(systems, gates);

describe("planRouteOn", () => {
  it("routes through Zarzakh by default (no longer hardcoded)", () => {
    const res = planRouteOn(map, { from: "Alpha", to: "Delta" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.summary.jumps).toBe(2);
  });

  it("avoids Zarzakh when it's in the avoidance list", () => {
    const res = planRouteOn(map, { from: "Alpha", to: "Delta", avoid: ["Zarzakh"] });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.summary.jumps).toBe(3);
      expect(res.steps.some((s) => s.systemName === "Zarzakh")).toBe(false);
    }
  });

  it("still routes TO Zarzakh even when it's in the avoid list", () => {
    const res = planRouteOn(map, { from: "Alpha", to: "Zarzakh", avoid: ["Zarzakh"] });
    expect(res.ok).toBe(true); // findRoute strips source/dest from the avoid set
    if (res.ok) expect(res.summary.jumps).toBe(1);
  });

  it("avoids named systems", () => {
    // Both gate paths (via Bravo and via Zarzakh) blocked => no route.
    const res = planRouteOn(map, { from: "Alpha", to: "Delta", avoid: ["Bravo", "Zarzakh"] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("no-route");
  });

  it("avoids whole regions, routing around them", () => {
    // Region 20 = Bravo; avoiding it forces the Alpha-Zarzakh-Delta path.
    const res = planRouteOn(map, { from: "Alpha", to: "Delta", avoidRegions: [20] });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.steps.some((s) => s.systemName === "Bravo")).toBe(false);
      expect(res.summary.jumps).toBe(2);
    }
  });

  it("reports unknown systems", () => {
    const res = planRouteOn(map, { from: "Nowhere", to: "Delta" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("unknown-from");
  });

  it("uses a wormhole chain and returns K-space waypoint anchors", () => {
    const chain: WormholeLink[] = [
      { a: 1, b: 31001000, info: { size: "large", mass: "stable", life: "stable", signatureFrom: "AAA-111", wormholeType: "N110" } },
      { a: 31001000, b: 4, info: { size: "large", mass: "stable", life: "stable", signatureFrom: "BBB-222", wormholeType: "K162" } },
    ];
    // planRouteOn is pure over its map; wormholes are baked in here (the
    // planRoute wrapper does this via applyWormholes on a clone).
    const mapWithChain = buildStarMap(systems, gates, chain);
    const res = planRouteOn(mapWithChain, { from: "Alpha", to: "Delta" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.summary.wormholeJumps).toBe(2);
      expect(res.summary.jumps).toBe(2);
      // J-space is skipped; only Alpha and Delta are valid autopilot waypoints.
      expect(res.waypoints).toEqual([1, 4]);
    }
  });
});
