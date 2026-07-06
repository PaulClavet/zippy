import type { WormholeLink } from "../graph/build";
import type { LifeStatus, WormholeSize } from "../graph/types";
import { USER_AGENT } from "../eve/constants";
import { formatSignature } from "../eve/format";
import { wormholeSizeFromCode } from "./statics";
import { wormholeLifeHours } from "./wormholes";
import type { MapperResult } from "./types";

const EVE_SCOUT_URL = "https://api.eve-scout.com/v2/public/signatures";
/** Community heuristic: a hole with <= this many hours left is "end of life". */
const EOL_HOURS = 4;

/** Subset of the Eve-Scout v2 public signature shape that we use. */
export interface EveScoutSignature {
  signature_type: string;
  wh_type: string | null;
  max_ship_size: string | null;
  remaining_hours: number | null;
  out_system_id: number;
  out_signature: string | null;
  in_system_id: number;
  in_signature: string | null;
  updated_at?: string;
}

function mapSize(value: string | null): WormholeSize {
  switch ((value ?? "").toLowerCase()) {
    case "small":
      return "small";
    case "medium":
      return "medium";
    case "large":
      return "large";
    case "xlarge":
    case "x-large":
    case "capital": // Eve-Scout's largest class
      return "xlarge";
    default:
      return "unknown";
  }
}

/** Pure parse (unit-testable) of an Eve-Scout signature list into graph links. */
export function parseEveScout(data: EveScoutSignature[], now: number): WormholeLink[] {
  const links: WormholeLink[] = [];
  for (const s of data) {
    if (s.signature_type !== "wormhole") continue;
    if (!s.out_system_id || !s.in_system_id) continue;

    let size = mapSize(s.max_ship_size);
    if (size === "unknown") size = wormholeSizeFromCode(s.wh_type);

    const life: LifeStatus =
      s.remaining_hours != null && s.remaining_hours <= EOL_HOURS ? "eol" : "stable";

    const ageHours =
      s.updated_at && !Number.isNaN(Date.parse(s.updated_at))
        ? Math.max(0, (now - Date.parse(s.updated_at)) / 3_600_000)
        : undefined;

    links.push({
      a: s.out_system_id,
      b: s.in_system_id,
      info: {
        size,
        mass: "unknown", // Eve-Scout doesn't expose live mass status
        life,
        signatureFrom: s.out_signature ? formatSignature(s.out_signature) : undefined,
        signatureTo: s.in_signature ? formatSignature(s.in_signature) : undefined,
        wormholeType: s.wh_type ?? undefined,
        ageHours,
        estimatedHoursLeft: s.remaining_hours ?? undefined,
        maxLifeHours: wormholeLifeHours(s.wh_type),
      },
    });
  }
  return links;
}

/**
 * Fetch the public Thera + Turnur wormhole connections from Eve-Scout. Requires
 * no authentication, which makes it the best zero-setup source of live holes.
 */
export async function fetchEveScout(signal?: AbortSignal): Promise<MapperResult> {
  const res = await fetch(EVE_SCOUT_URL, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal,
  });
  if (!res.ok) {
    throw new Error(`Eve-Scout request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as EveScoutSignature[];
  const now = Date.now();
  const links = parseEveScout(data, now);
  return {
    source: "eve-scout",
    fetchedAt: new Date(now).toISOString(),
    count: links.length,
    links,
  };
}
