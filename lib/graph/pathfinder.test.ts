import { describe, expect, it } from "vitest";
import { buildStarMap, type WormholeLink } from "./build";
import { findRoute } from "./pathfinder";
import type { SolarSystem, SystemId } from "./types";

const sys = (id: number, name: string, security: number): SolarSystem => ({
  id,
  name,
  security,
});

// A tiny hand-built map:
//   1(hi) - 2(hi) - 3(hi) - 4(hi)      gate chain, 3 jumps
//   1(hi) - 5(low) - 4(hi)            lowsec shortcut, 2 jumps
//   1 <=> 4                           wormhole (added separately)
const systems: SolarSystem[] = [
  sys(1, "Origin", 0.9),
  sys(2, "Alpha", 0.8),
  sys(3, "Bravo", 0.7),
  sys(4, "Dest", 0.9),
  sys(5, "Sketchy", 0.2), // lowsec
];
const gates: Array<[SystemId, SystemId]> = [
  [1, 2],
  [2, 3],
  [3, 4],
  [1, 5],
  [5, 4],
];

const wormhole: WormholeLink = {
  a: 1,
  b: 4,
  info: { size: "medium", mass: "stable", life: "stable", signatureFrom: "ABC-123", wormholeType: "K162" },
};

describe("findRoute", () => {
  it("finds the fewest-jumps gate path", () => {
    const map = buildStarMap(systems, gates);
    const route = findRoute(map, 1, 4, { useWormholes: false });
    expect(route).not.toBeNull();
    // Shortest is the lowsec shortcut 1 -> 5 -> 4 (2 jumps).
    expect(route!.jumps).toBe(2);
    expect(route!.hops.map((h) => h.system.name)).toEqual(["Origin", "Sketchy", "Dest"]);
  });

  it("uses a wormhole shortcut when enabled", () => {
    const map = buildStarMap(systems, gates, [wormhole]);
    const route = findRoute(map, 1, 4, { useWormholes: true });
    expect(route!.jumps).toBe(1);
    expect(route!.wormholeJumps).toBe(1);
    expect(route!.hops[1].connection?.type).toBe("wormhole");
    expect(route!.hops[1].connection?.wormhole?.signatureFrom).toBe("ABC-123");
  });

  it("ignores wormholes when disabled", () => {
    const map = buildStarMap(systems, gates, [wormhole]);
    const route = findRoute(map, 1, 4, { useWormholes: false });
    expect(route!.wormholeJumps).toBe(0);
  });

  it("respects security weights by avoiding lowsec", () => {
    const map = buildStarMap(systems, gates);
    const route = findRoute(map, 1, 4, {
      securityPrio: { lowsec: 100, nullsec: 100 },
      useWormholes: false,
    });
    // Takes the all-highsec gate chain (3 jumps) instead of lowsec (2 jumps).
    expect(route!.jumps).toBe(3);
    expect(route!.hops.map((h) => h.system.name)).toEqual(["Origin", "Alpha", "Bravo", "Dest"]);
  });

  it("routes around avoided systems", () => {
    const map = buildStarMap(systems, gates);
    const route = findRoute(map, 1, 4, { avoid: [5], useWormholes: false });
    expect(route!.hops.some((h) => h.system.id === 5)).toBe(false);
    expect(route!.jumps).toBe(3);
  });

  it("skips wormholes too small for the ship", () => {
    const map = buildStarMap(systems, gates, [wormhole]);
    const route = findRoute(map, 1, 4, {
      useWormholes: true,
      wormholes: { minSize: "large" }, // hole is only "medium"
    });
    expect(route!.wormholeJumps).toBe(0);
    expect(route!.jumps).toBe(2); // falls back to gates
  });

  it("skips end-of-life holes when disallowed", () => {
    const eol: WormholeLink = { ...wormhole, info: { ...wormhole.info, life: "eol" } };
    const map = buildStarMap(systems, gates, [eol]);
    const route = findRoute(map, 1, 4, { useWormholes: true, wormholes: { allowEol: false } });
    expect(route!.wormholeJumps).toBe(0);
  });

  it("drops impossible wormholes past their TYPE's lifetime (48h fallback if unknown)", () => {
    // Unknown max life (like K162) aged 30h is still possible under the 48h fallback.
    const generic = buildStarMap(systems, gates, [{ ...wormhole, info: { ...wormhole.info, ageHours: 30 } }]);
    expect(findRoute(generic, 1, 4, { useWormholes: true })!.wormholeJumps).toBe(1);

    // A 16h-max hole aged 30h is impossible → dropped, falling back to gates.
    const short = buildStarMap(systems, gates, [
      { ...wormhole, info: { ...wormhole.info, ageHours: 30, maxLifeHours: 16 } },
    ]);
    expect(findRoute(short, 1, 4, { useWormholes: true })!.wormholeJumps).toBe(0);
    // Explicitly keep impossible holes → used again (1 jump).
    expect(
      findRoute(short, 1, 4, { useWormholes: true, wormholes: { dropImpossibleAge: false } })!.wormholeJumps,
    ).toBe(1);
  });

  it("drops ghost sigs (no type, no signature) by default", () => {
    const blank: WormholeLink = { a: 1, b: 4, info: { size: "medium", mass: "stable", life: "stable" } };
    const map = buildStarMap(systems, gates, [blank]);
    expect(findRoute(map, 1, 4, { useWormholes: true })!.wormholeJumps).toBe(0);
    const kept = findRoute(map, 1, 4, { useWormholes: true, wormholes: { dropUnidentified: false } });
    expect(kept!.wormholeJumps).toBe(1);
  });

  it("returns null when no route exists", () => {
    const map = buildStarMap([...systems, sys(99, "Island", 0.5)], gates);
    expect(findRoute(map, 1, 99)).toBeNull();
  });

  it("returns a zero-jump route for identical endpoints", () => {
    const map = buildStarMap(systems, gates);
    const route = findRoute(map, 1, 1);
    expect(route!.jumps).toBe(0);
    expect(route!.hops).toHaveLength(1);
  });
});
