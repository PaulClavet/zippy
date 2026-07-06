/**
 * Core graph types for Zippy's solar-system routing.
 *
 * The star map is a directed weighted graph. Nodes are solar systems; edges are
 * either permanent stargate connections ("gate") or transient wormhole
 * connections ("wormhole") sourced from a mapper like Tripwire.
 */

export type SystemId = number;

export type SecurityBand = "highsec" | "lowsec" | "nullsec" | "wspace";

export type ConnectionType = "gate" | "wormhole";

/** Wormhole size classes, smallest → largest (maps to max jumpable ship mass). */
export type WormholeSize = "small" | "medium" | "large" | "xlarge" | "unknown";

/** Tripwire mass status of a wormhole. */
export type MassStatus = "stable" | "destab" | "critical" | "unknown";

/** Tripwire life status of a wormhole. */
export type LifeStatus = "stable" | "eol" | "unknown";

export interface SolarSystem {
  id: SystemId;
  name: string;
  /** Raw security status, -1.0 .. 1.0 (see securityBand for display rounding). */
  security: number;
  regionId?: number;
  regionName?: string;
  constellationId?: number;
}

export interface WormholeInfo {
  size: WormholeSize;
  mass: MassStatus;
  life: LifeStatus;
  /** In-system scan signature at the `from` side, e.g. "ABC-123". */
  signatureFrom?: string;
  /** In-system scan signature at the `to` side. */
  signatureTo?: string;
  /** Wormhole type code, e.g. "K162", "C247", "N110". */
  wormholeType?: string;
  /** Age of the signature in hours since discovery/last update, if known. */
  ageHours?: number;
  /** Reported hours remaining, when a mapper provides an estimate (Eve-Scout). */
  estimatedHoursLeft?: number;
  /** Maximum lifetime (hours) for this wormhole's type, if known (from the SDE). */
  maxLifeHours?: number;
}

export interface Connection {
  from: SystemId;
  to: SystemId;
  type: ConnectionType;
  /** Present only when type === "wormhole". */
  wormhole?: WormholeInfo;
}

export interface StarMap {
  systems: Map<SystemId, SolarSystem>;
  /** Adjacency list: systemId -> outgoing connections. */
  connections: Map<SystemId, Connection[]>;
}

/**
 * EVE rounds security to one decimal for display; a raw 0.45 shows as 0.5 and
 * counts as highsec. J-space (wormhole) systems have ids at/above 31000000.
 */
export function securityBand(system: SolarSystem): SecurityBand {
  if (system.id >= 31_000_000) return "wspace";
  const rounded = Math.round(system.security * 10) / 10;
  if (rounded >= 0.5) return "highsec";
  if (rounded >= 0.1) return "lowsec";
  return "nullsec";
}

export function displaySecurity(security: number): string {
  // EVE convention: clamp display to one decimal, never show "-0.0".
  const rounded = Math.round(security * 10) / 10;
  const value = rounded === 0 ? 0 : rounded;
  return value.toFixed(1);
}
