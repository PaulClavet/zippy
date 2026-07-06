import type { WormholeSize } from "../graph/types";
import staticsJson from "./statics.json";

/**
 * Wormhole type code → size class, from Short Circuit's statics.csv.
 * K162 (the generic "exit" hole) is intentionally absent — its size is
 * determined by whatever created it, so it resolves to "unknown".
 */
const CODE_SIZE = staticsJson as Record<string, WormholeSize>;

export function wormholeSizeFromCode(code: string | null | undefined): WormholeSize {
  if (!code) return "unknown";
  return CODE_SIZE[code.trim().toUpperCase()] ?? "unknown";
}
