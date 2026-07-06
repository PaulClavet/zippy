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
  info: { size: "large", mass: "stable", life: "stable", signatureFrom: "XYZ-001", signatureTo: "QRS-999", wormholeType: "K162", ageHours: 2 },
};

describe("navigation", () => {
  const map = buildStarMap(systems, gates, [wormhole]);
  const route = findRoute(map, 1, 4, { useWormholes: true })!;

  it("describes the action to take in each system (departure-based)", () => {
    const steps = describeRoute(route);
    // Row 0 is the origin, and its action is the first departure.
    expect(steps[0].systemName).toBe("Amarr");
    expect(steps[0].action).toBe("Take the stargate to Ashab");
    expect(steps[0].via).toBe("gate");

    // The wormhole details attach to the system you jump FROM (Niarja).
    const whStep = steps.find((s) => s.via === "wormhole")!;
    expect(whStep.systemName).toBe("Niarja");
    expect(whStep.action).toContain("Jump wormhole XYZ-001 [K162] to J111111");
    expect(whStep.wormhole?.signature).toBe("XYZ-001");
    expect(whStep.wormhole?.returnSignature).toBe("QRS-999");
    expect(whStep.wormhole?.size).toBe("large");
    // Discovered 2h ago → at most 24 - 2 = 22h left.
    expect(whStep.wormhole?.maxHoursLeft).toBe(22);

    const last = steps[steps.length - 1];
    expect(last.systemName).toBe("Uedama");
    expect(last.isDestination).toBe(true);
    expect(last.action).toContain("destination");
  });

  it("formats a compact fleet one-liner with collapsed gate runs and wormhole sigs", () => {
    const line = formatFleetRoute(route);
    expect(line).toBe(
      "Zippy: Amarr --2 gates--> Niarja ~~>[XYZ-001 K162] J111111 --1 gate--> Uedama",
    );
  });
});
