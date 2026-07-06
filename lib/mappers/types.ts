import type { WormholeLink } from "../graph/build";

export type MapperSource = "eve-scout" | "tripwire";

/** Result of fetching wormhole connections from a mapper. */
export interface MapperResult {
  source: MapperSource;
  fetchedAt: string;
  count: number;
  links: WormholeLink[];
  warnings?: string[];
}
