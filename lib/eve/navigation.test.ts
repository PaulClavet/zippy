import { describe, expect, it } from "vitest";
import { buildStarMap, type WormholeLink } from "../graph/build";
import { findRoute } from "../graph/pathfinder";
import type { SolarSystem, SystemId } from "../graph/types";
import { describeRoute, formatFleetRoute } from "./navigation";

const sys = (id: number, name: string, security: number): SolarSystem => ({ id, name, security });

// A --gate--> B --gate--> C ~~wormhole~~> J111111 --gate--> D
const systems: SolarSystem[] = [
  sys(1, "Amarr", 1.0),
  sys(2, "Ashab", 1.0),
  sys(3, "Niarja", 0.5),
  sys(31000001, "J111111", -1.0),
  sys(4, "Uedama", 0.5),
];
const gates: Array<[SystemId, SystemId]> = [
  [1, 2],
  [2, 3],
  [31000001, 4],
];
const wormhole: WormholeLink = {
  a: 3,
  b: 31000001,
  info: { size: "large", mass: "stable", life: "stable", signatureFrom: "XYZ-001", signatureTo: "QRS-999", wormholeType: "K162" },
};

describe("navigation", () => {
  const map = buildStarMap(systems, gates, [wormhole]);
  const route = findRoute(map, 1, 4, { useWormholes: true })!;

  it("produces per-hop instructions", () => {
    const steps = describeRoute(route);
    expect(steps[0].instruction).toBe("Start here");
    expect(steps[1].instruction).toContain("stargate to Ashab");
    const whStep = steps.find((s) => s.connectionType === "wormhole")!;
    expect(whStep.instruction).toContain("Jump wormhole XYZ-001 [K162]");
    expect(whStep.signature).toBe("XYZ-001");
    expect(whStep.returnSignature).toBe("QRS-999");
    expect(steps[steps.length - 1].instruction).toContain("destination");
  });

  it("formats a compact fleet one-liner with collapsed gate runs and wormhole sigs", () => {
    const line = formatFleetRoute(route);
    expect(line).toBe(
      "Zippy: Amarr --2 gates--> Niarja ~~>[XYZ-001 K162] J111111 --1 gate--> Uedama",
    );
  });
});
