import { applyWormholes, cloneStarMap, type WormholeLink } from "../graph/build";
import {
  findRoute,
  type Route,
  type SecurityPrio,
  type WormholeConstraints,
} from "../graph/pathfinder";
import type { StarMap } from "../graph/types";
import { loadBaseStarMap } from "../sde/loader";
import { resolveSystem } from "../sde/lookup";
import { SECURITY_PRESETS, type SecurityPresetKey } from "./constants";
import { describeRoute, formatFleetRoute, type RouteStep } from "./navigation";

export interface PlanRequest {
  from: string | number;
  to: string | number;
  /** Named security preset; ignored if securityPrio is given. */
  preset?: SecurityPresetKey;
  securityPrio?: SecurityPrio;
  useWormholes?: boolean;
  wormholes?: WormholeConstraints;
  /** Systems to avoid (names or ids). */
  avoid?: Array<string | number>;
  /** Region ids to avoid entirely (all member systems excluded). */
  avoidRegions?: number[];
  /** Live wormhole connections from mappers to layer onto the gate map. */
  chain?: WormholeLink[];
}

export interface PlanSummary {
  jumps: number;
  gateJumps: number;
  wormholeJumps: number;
}

export interface PlanSuccess {
  ok: true;
  summary: PlanSummary;
  steps: RouteStep[];
  fleet: string;
  /** K-space anchor system ids to breadcrumb into the in-game autopilot. */
  waypoints: number[];
}

export interface PlanFailure {
  ok: false;
  code: "unknown-from" | "unknown-to" | "no-route";
  error: string;
}

export type PlanResult = PlanSuccess | PlanFailure;

const KSPACE_MAX_ID = 31_000_000;

/**
 * K-space anchor systems to feed the in-game autopilot: source, destination,
 * and the systems on either side of every wormhole jump. The autopilot gate-
 * routes between consecutive anchors; wormhole jumps are flown manually.
 */
export function waypointAnchors(route: Route): number[] {
  const hops = route.hops;
  const anchors: number[] = [];
  const push = (id: number) => {
    if (id < KSPACE_MAX_ID && anchors[anchors.length - 1] !== id) anchors.push(id);
  };
  for (let i = 0; i < hops.length; i++) {
    const arrivedByWormhole = hops[i].connection?.type === "wormhole";
    const nextIsWormhole = hops[i + 1]?.connection?.type === "wormhole";
    if (i === 0 || i === hops.length - 1 || arrivedByWormhole || nextIsWormhole) {
      push(hops[i].system.id);
    }
  }
  return anchors;
}

/** Pure planner over a given map (unit-testable). */
export function planRouteOn(map: StarMap, req: PlanRequest): PlanResult {
  const from = resolveSystem(map, req.from);
  if (from == null) {
    return { ok: false, code: "unknown-from", error: `Unknown source system: "${req.from}"` };
  }
  const to = resolveSystem(map, req.to);
  if (to == null) {
    return { ok: false, code: "unknown-to", error: `Unknown destination system: "${req.to}"` };
  }

  const avoid = new Set<number>();
  for (const ref of req.avoid ?? []) {
    const id = resolveSystem(map, ref);
    if (id != null) avoid.add(id);
  }
  if (req.avoidRegions?.length) {
    const regions = new Set(req.avoidRegions);
    for (const s of map.systems.values()) {
      if (s.regionId != null && regions.has(s.regionId)) avoid.add(s.id);
    }
  }

  const securityPrio = req.securityPrio ?? SECURITY_PRESETS[req.preset ?? "shortest"].prio;

  const route = findRoute(map, from, to, {
    avoid,
    securityPrio,
    useWormholes: req.useWormholes ?? true,
    wormholes: req.wormholes,
  });
  if (!route) {
    return { ok: false, code: "no-route", error: "No route found under these restrictions." };
  }

  return {
    ok: true,
    summary: {
      jumps: route.jumps,
      gateJumps: route.gateJumps,
      wormholeJumps: route.wormholeJumps,
    },
    steps: describeRoute(route),
    fleet: formatFleetRoute(route),
    waypoints: waypointAnchors(route),
  };
}

/** Plan a route over the live star map, layering in any provided wormhole chain. */
export function planRoute(req: PlanRequest): PlanResult {
  const base = loadBaseStarMap();
  const map = req.chain?.length ? cloneStarMap(base) : base;
  if (req.chain?.length) applyWormholes(map, req.chain);
  return planRouteOn(map, req);
}
