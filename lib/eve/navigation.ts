import type { ConnectionType } from "../graph/types";
import type { Route } from "../graph/pathfinder";

/** A single hop rendered for the route table. */
export interface RouteStep {
  index: number;
  systemId: number;
  systemName: string;
  security: number;
  regionName?: string;
  /** How you arrived at this system (undefined for the origin). */
  connectionType?: ConnectionType;
  /** Wormhole signature on the entry side, e.g. "ABC-123". */
  signature?: string;
  /** Wormhole signature on the far side (the return hole). */
  returnSignature?: string;
  /** Wormhole type code, e.g. "K162". */
  wormholeType?: string;
  /** Human-readable instruction for this hop. */
  instruction: string;
}

export function describeRoute(route: Route): RouteStep[] {
  const last = route.hops.length - 1;
  return route.hops.map((hop, i) => {
    const sys = hop.system;
    const conn = hop.connection;
    const wh = conn?.wormhole;

    let instruction: string;
    if (!conn) {
      instruction = "Start here";
    } else if (conn.type === "gate") {
      instruction = `Take the stargate to ${sys.name}`;
    } else {
      const sig = wh?.signatureFrom ?? "???";
      const code = wh?.wormholeType ?? "----";
      instruction = `Jump wormhole ${sig} [${code}] into ${sys.name}`;
    }
    if (i === last && last > 0) instruction += " — arrive at destination";

    return {
      index: i,
      systemId: sys.id,
      systemName: sys.name,
      security: sys.security,
      regionName: sys.regionName,
      connectionType: conn?.type,
      signature: wh?.signatureFrom,
      returnSignature: wh?.signatureTo,
      wormholeType: wh?.wormholeType,
      instruction,
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
