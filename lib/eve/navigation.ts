import type {
  ConnectionType,
  LifeStatus,
  MassStatus,
  WormholeInfo,
  WormholeSize,
} from "../graph/types";
import { FALLBACK_MAX_WORMHOLE_LIFETIME_HOURS, type Route } from "../graph/pathfinder";

/** A hole flagged end-of-life has at most ~4 hours left. */
const EOL_MAX_HOURS = 4;

export interface WormholeDetails {
  /** Signature to scan in THIS system (the side you jump from). */
  signature?: string;
  /** Signature on the far side (the return hole). */
  returnSignature?: string;
  type?: string;
  size: WormholeSize;
  mass: MassStatus;
  life: LifeStatus;
  /** Hours since discovery/last update. */
  ageHours?: number;
  /** Reported hours remaining, if a mapper estimates it. */
  estimatedHoursLeft?: number;
  /** This wormhole type's maximum lifetime (hours), if known. */
  maxLifeHours?: number;
  /** Upper bound on time remaining, from type lifetime − discovery age (+ EOL cap). */
  maxHoursLeft?: number;
}

/** One row of the route: a system and the action to take while in it. */
export interface RouteStep {
  index: number;
  systemId: number;
  systemName: string;
  security: number;
  regionName?: string;
  /** What to do in THIS system to proceed (undefined only at the destination). */
  action?: string;
  /** How you leave this system. */
  via?: ConnectionType;
  /** Details of the outgoing jump, when leaving via a wormhole. */
  wormhole?: WormholeDetails;
  isDestination: boolean;
}

function maxHoursLeft(wh: WormholeInfo): number | undefined {
  if (wh.ageHours == null) return undefined;
  const maxLife = wh.maxLifeHours ?? FALLBACK_MAX_WORMHOLE_LIFETIME_HOURS;
  let max = Math.max(0, maxLife - wh.ageHours);
  if (wh.life === "eol") max = Math.min(max, EOL_MAX_HOURS);
  return Math.round(max * 10) / 10;
}

/**
 * Turn a route into per-system rows describing the action to take *in* each
 * system. A row's action refers to the connection *leaving* it (departure-
 * based), so e.g. the origin row reads "Take the stargate to <next>". Wormhole
 * departures carry the hole's details (type/size/mass/life/time).
 */
export function describeRoute(route: Route): RouteStep[] {
  const hops = route.hops;
  return hops.map((hop, i) => {
    const sys = hop.system;
    const next = hops[i + 1];
    const base = {
      index: i,
      systemId: sys.id,
      systemName: sys.name,
      security: sys.security,
      regionName: sys.regionName,
    };

    if (!next) {
      return { ...base, action: "Arrive — destination", isDestination: true };
    }

    const conn = next.connection!;
    if (conn.type === "gate") {
      return {
        ...base,
        action: `Take the stargate to ${next.system.name}`,
        via: "gate" as const,
        isDestination: false,
      };
    }

    const wh = conn.wormhole;
    const sig = wh?.signatureFrom ?? "???";
    const code = wh?.wormholeType ?? "----";
    const wormhole: WormholeDetails | undefined = wh
      ? {
          signature: wh.signatureFrom,
          returnSignature: wh.signatureTo,
          type: wh.wormholeType,
          size: wh.size,
          mass: wh.mass,
          life: wh.life,
          ageHours: wh.ageHours,
          estimatedHoursLeft: wh.estimatedHoursLeft,
          maxLifeHours: wh.maxLifeHours,
          maxHoursLeft: maxHoursLeft(wh),
        }
      : undefined;

    return {
      ...base,
      action: `Jump wormhole ${sig} [${code}] to ${next.system.name}`,
      via: "wormhole" as const,
      wormhole,
      isDestination: false,
    };
  });
}

/**
 * Compact, copy-pasteable one-liner for fleet chat (the "FC, please help!"
 * format). Runs of consecutive stargate jumps are collapsed to a count; each
 * wormhole jump is shown inline with its signature and type code.
 *
 *   Zippy: Jita --3 gates--> Nourvukaiken ~~>[ABC-123 K162] J123456 --1 gate--> Amamake
 */
export function formatFleetRoute(route: Route): string {
  const hops = route.hops;
  if (hops.length <= 1) {
    return `Zippy: ${hops[0]?.system.name ?? "?"} (already there)`;
  }

  let out = hops[0].system.name;
  let gateRun = 0;

  const flushGates = (throughSystem: string) => {
    if (gateRun > 0) {
      out += ` --${gateRun} ${gateRun === 1 ? "gate" : "gates"}--> ${throughSystem}`;
      gateRun = 0;
    }
  };

  for (let i = 1; i < hops.length; i++) {
    const conn = hops[i].connection!;
    if (conn.type === "gate") {
      gateRun++;
      continue;
    }
    // Wormhole jump: first close out the gate run leading up to its entry side.
    flushGates(hops[i - 1].system.name);
    const sig = conn.wormhole?.signatureFrom ?? "???";
    const code = conn.wormhole?.wormholeType ?? "----";
    out += ` ~~>[${sig} ${code}] ${hops[i].system.name}`;
  }
  flushGates(hops[hops.length - 1].system.name);

  return `Zippy: ${out}`;
}
