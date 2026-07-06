import { describe, expect, it } from "vitest";
import { findRoute } from "../graph/pathfinder";
import { loadBaseStarMap, sdeMeta } from "./loader";
import { resolveSystem, searchSystems } from "./lookup";

// These assertions only hold against the full SDE (run `pnpm sde:build`).
// When only the demo fallback is present, they're skipped.
const demo = sdeMeta().isDemo;

describe("SDE loader", () => {
  const map = loadBaseStarMap();

  it("loads a non-empty star map", () => {
    expect(map.systems.size).toBeGreaterThan(0);
  });

  it.skipIf(demo)("loads the full universe (thousands of systems)", () => {
    expect(map.systems.size).toBeGreaterThan(5000);
  });

  it.skipIf(demo)("routes Jita -> Amarr across stargates", () => {
    const jita = resolveSystem(map, "Jita");
    const amarr = resolveSystem(map, "Amarr");
    expect(jita).not.toBeNull();
    expect(amarr).not.toBeNull();
    const route = findRoute(map, jita!, amarr!, { useWormholes: false });
    expect(route).not.toBeNull();
    // Jita → Amarr is roughly 9–10 gate jumps.
    expect(route!.gateJumps).toBeGreaterThan(5);
    expect(route!.wormholeJumps).toBe(0);
  });

  it.skipIf(demo)("finds systems by name prefix", () => {
    const results = searchSystems(map, "jit");
    expect(results.some((s) => s.name === "Jita")).toBe(true);
  });
});
