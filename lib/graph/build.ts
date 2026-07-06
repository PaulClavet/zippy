import type {
  Connection,
  SolarSystem,
  StarMap,
  SystemId,
  WormholeInfo,
} from "./types";

/** A bidirectional wormhole link to merge into the map (e.g. from Tripwire). */
export interface WormholeLink {
  a: SystemId;
  b: SystemId;
  info: WormholeInfo;
}

/**
 * Build a StarMap from a system list and undirected gate pairs. Gate jumps are
 * stored in both directions. Optional wormhole links are merged in as well.
 */
export function buildStarMap(
  systems: Iterable<SolarSystem>,
  gates: Iterable<readonly [SystemId, SystemId]>,
  wormholes: Iterable<WormholeLink> = [],
): StarMap {
  const systemMap = new Map<SystemId, SolarSystem>();
  for (const s of systems) systemMap.set(s.id, s);

  const map: StarMap = { systems: systemMap, connections: new Map() };

  for (const [a, b] of gates) {
    addConnection(map, { from: a, to: b, type: "gate" });
    addConnection(map, { from: b, to: a, type: "gate" });
  }
  for (const wh of wormholes) addWormhole(map, wh);

  return map;
}

export function addConnection(map: StarMap, conn: Connection): void {
  const list = map.connections.get(conn.from);
  if (list) list.push(conn);
  else map.connections.set(conn.from, [conn]);
}

/** Add a wormhole as two directed connections (both traversal directions). */
export function addWormhole(map: StarMap, wh: WormholeLink): void {
  addConnection(map, {
    from: wh.a,
    to: wh.b,
    type: "wormhole",
    wormhole: { ...wh.info, signatureFrom: wh.info.signatureFrom, signatureTo: wh.info.signatureTo },
  });
  addConnection(map, {
    from: wh.b,
    to: wh.a,
    type: "wormhole",
    // From the reverse side, the two signatures swap roles.
    wormhole: {
      ...wh.info,
      signatureFrom: wh.info.signatureTo,
      signatureTo: wh.info.signatureFrom,
    },
  });
}

/**
 * Return a shallow clone of a StarMap so live wormhole data can be layered on
 * without mutating the shared, cached gate-only base map.
 */
export function cloneStarMap(base: StarMap): StarMap {
  const connections = new Map<SystemId, Connection[]>();
  for (const [id, list] of base.connections) connections.set(id, [...list]);
  return { systems: base.systems, connections };
}

export function applyWormholes(map: StarMap, wormholes: Iterable<WormholeLink>): void {
  for (const wh of wormholes) addWormhole(map, wh);
}
