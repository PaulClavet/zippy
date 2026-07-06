import type { WormholeLink } from "../graph/build";

export type MapperSource = "eve-scout" | "tripwire";

/** Result of fetching wormhole connections from a mapper. */
export interface MapperResult {
  source: MapperSource;
  fetchedAt: string;
  count: number;
  links: WormholeLink[];
  warnings?: string[];
  /** Tripwire only: per-system tracked pilot counts (mask-wide). */
  occupied?: Array<{ systemID: number; count: number }>;
}

/** A tracked pilot in a system (from Tripwire occupants.php). */
export interface TrackedOccupant {
  name: string;
  /** Ship type name, or "-" when the pilot hides it. */
  ship: string;
}
