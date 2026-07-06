import wormholesJson from "./wormholes.json";

/**
 * Per-type wormhole reference from the EVE SDE (built by scripts/build-wormholes.mjs).
 * Lifetimes vary by type — 4.5h to 48h — so we never assume a flat value.
 */
interface WormholeTypeInfo {
  lifeHours: number | null;
  totalMass: number | null;
  jumpMass: number | null;
}

const WH = wormholesJson as Record<string, WormholeTypeInfo>;

/**
 * Maximum lifetime (hours) for a wormhole type code, or undefined when unknown
 * (e.g. K162, whose real lifetime is that of the hole that spawned it).
 */
export function wormholeLifeHours(code: string | null | undefined): number | undefined {
  if (!code) return undefined;
  const rec = WH[code.trim().toUpperCase()];
  return rec && rec.lifeHours != null ? rec.lifeHours : undefined;
}
