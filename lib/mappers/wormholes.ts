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

/** K162 has no fixed life (it inherits its parent hole's); use the 48h ceiling
 *  — the longest any EVE wormhole lives — so legit exits aren't false-dropped. */
const K162_CEILING_HOURS = 48;

/**
 * Maximum lifetime (hours) for a wormhole type code. K162 → 48h ceiling; a
 * known type → its SDE lifetime; anything else (untyped/unrecognized) →
 * undefined, so the caller applies its untyped fallback.
 */
export function wormholeLifeHours(code: string | null | undefined): number | undefined {
  if (!code) return undefined;
  const c = code.trim().toUpperCase();
  if (c === "K162") return K162_CEILING_HOURS;
  const rec = WH[c];
  return rec && rec.lifeHours != null ? rec.lifeHours : undefined;
}
