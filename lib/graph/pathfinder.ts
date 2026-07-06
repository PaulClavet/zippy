import { MinHeap } from "./heap";
import {
  type Connection,
  type SecurityBand,
  type SolarSystem,
  type StarMap,
  type SystemId,
  type WormholeSize,
  securityBand,
} from "./types";

/**
 * Fallback maximum wormhole lifetime (hours) for holes with NO usable type
 * (untyped, or an unrecognized code). Set to 16h — the most common lifetime —
 * because well-run maps record types diligently, so an untyped hole is usually
 * a stale/error sig; a tighter ceiling drops those ghosts sooner. Known types
 * use their SDE lifetime; K162 (generic reverse) carries its own 48h ceiling
 * (see wormholeLifeHours) so legit long-hole exits aren't false-dropped.
 */
export const FALLBACK_MAX_WORMHOLE_LIFETIME_HOURS = 16;

/** Constraints applied to wormhole connections during routing. */
export interface WormholeConstraints {
  /**
   * Smallest hole your ship can fit through. A wormhole is blocked if its size
   * class is strictly smaller than this. Holes of "unknown" size are never
   * blocked by this rule (matching Short Circuit's behaviour).
   */
  minSize?: WormholeSize;
  /** Allow end-of-life holes (default true). false blocks life === "eol". */
  allowEol?: boolean;
  /** Allow mass-critical holes (default true). false blocks mass === "critical". */
  allowMassCritical?: boolean;
  /** Allow mass-destabilized holes (default true). false blocks mass === "destab". */
  allowMassDestab?: boolean;
  /** Block holes whose signature is older than this many hours (when age known). */
  maxAgeHours?: number;
  /**
   * Drop "impossible wormholes" — holes older than the maximum possible
   * lifetime (nothing in EVE lasts >24h). Default ON; set false to keep them.
   */
  dropImpossibleAge?: boolean;
  /**
   * Drop "ghost sigs" — wormholes with no type code AND no signature id (e.g.
   * dead K→K holes recorded by left-on auto-tracking). Default ON.
   */
  dropUnidentified?: boolean;
}

/**
 * Per-security-band traversal weight, 1..100 (lower = more preferred). The cost
 * of entering a system is the weight of that system's band; wormhole hops use
 * the `wspace` weight. Defaults to 1 for every band → fewest-jumps routing.
 * e.g. { nullsec: 100, lowsec: 50 } steers routes toward highsec.
 */
export type SecurityPrio = Partial<Record<SecurityBand, number>>;

export interface RouteOptions {
  /** Systems to route around entirely (never entered, except endpoints). */
  avoid?: Iterable<SystemId>;
  /** Per-band weights; default 1 everywhere (minimize hop count). */
  securityPrio?: SecurityPrio;
  /** Include wormhole connections in routing (default true). */
  useWormholes?: boolean;
  wormholes?: WormholeConstraints;
}

export interface RouteHop {
  system: SolarSystem;
  /** The connection traversed to REACH this system (undefined for the origin). */
  connection?: Connection;
}

export interface Route {
  hops: RouteHop[];
  jumps: number;
  gateJumps: number;
  wormholeJumps: number;
}

const SIZE_ORDER: Record<WormholeSize, number> = {
  unknown: -1,
  small: 0,
  medium: 1,
  large: 2,
  xlarge: 3,
};

function isPassable(conn: Connection, opts: RouteOptions): boolean {
  if (conn.type !== "wormhole") return true;
  if (opts.useWormholes === false) return false;

  const wh = conn.wormhole;
  const c = opts.wormholes ?? {};
  if (!wh) return true;

  // Unknown-size holes are never blocked by a minimum-size requirement.
  if (
    c.minSize &&
    c.minSize !== "unknown" &&
    wh.size !== "unknown" &&
    SIZE_ORDER[wh.size] < SIZE_ORDER[c.minSize]
  ) {
    return false;
  }
  if (c.allowEol === false && wh.life === "eol") return false;
  if (c.allowMassCritical === false && wh.mass === "critical") return false;
  if (c.allowMassDestab === false && wh.mass === "destab") return false;
  if (c.maxAgeHours != null && wh.ageHours != null && wh.ageHours > c.maxAgeHours) {
    return false;
  }
  // Impossible-wormhole (age) and ghost-sig (no type/id) guards; default on.
  if (c.dropImpossibleAge !== false && wh.ageHours != null) {
    const maxLife = wh.maxLifeHours ?? FALLBACK_MAX_WORMHOLE_LIFETIME_HOURS;
    if (wh.ageHours > maxLife) return false;
  }
  if (c.dropUnidentified !== false && !wh.wormholeType && !wh.signatureFrom && !wh.signatureTo) {
    return false;
  }
  return true;
}

function edgeWeight(
  conn: Connection,
  target: SolarSystem,
  prio: Required<SecurityPrio>,
): number {
  if (conn.type === "wormhole") return prio.wspace;
  return prio[securityBand(target)];
}

/**
 * Dijkstra shortest path over the star map. Returns null if `from`/`to` are
 * unknown or no route exists under the given constraints.
 */
export function findRoute(
  map: StarMap,
  from: SystemId,
  to: SystemId,
  options: RouteOptions = {},
): Route | null {
  if (!map.systems.has(from) || !map.systems.has(to)) return null;

  const prio: Required<SecurityPrio> = {
    highsec: options.securityPrio?.highsec ?? 1,
    lowsec: options.securityPrio?.lowsec ?? 1,
    nullsec: options.securityPrio?.nullsec ?? 1,
    wspace: options.securityPrio?.wspace ?? 1,
  };

  const avoid = new Set<SystemId>(options.avoid ?? []);
  avoid.delete(from);
  avoid.delete(to);

  const dist = new Map<SystemId, number>([[from, 0]]);
  const prev = new Map<SystemId, Connection>();
  const visited = new Set<SystemId>();
  const heap = new MinHeap<SystemId>();
  heap.push(0, from);

  while (heap.size > 0) {
    const u = heap.pop()!;
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === to) break;

    const edges = map.connections.get(u);
    if (!edges) continue;

    for (const conn of edges) {
      const v = conn.to;
      if (visited.has(v) || avoid.has(v)) continue;
      if (!isPassable(conn, options)) continue;

      const target = map.systems.get(v);
      if (!target) continue;

      const nd = (dist.get(u) ?? Infinity) + edgeWeight(conn, target, prio);
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, conn);
        heap.push(nd, v);
      }
    }
  }

  if (from !== to && !prev.has(to)) return null;

  // Reconstruct the path from `to` back to `from`.
  const connections: Connection[] = [];
  let cur = to;
  while (cur !== from) {
    const conn = prev.get(cur);
    if (!conn) return null;
    connections.push(conn);
    cur = conn.from;
  }
  connections.reverse();

  const hops: RouteHop[] = [{ system: map.systems.get(from)! }];
  let gateJumps = 0;
  let wormholeJumps = 0;
  for (const conn of connections) {
    hops.push({ system: map.systems.get(conn.to)!, connection: conn });
    if (conn.type === "wormhole") wormholeJumps++;
    else gateJumps++;
  }

  return { hops, jumps: connections.length, gateJumps, wormholeJumps };
}
