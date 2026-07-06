import type { WormholeLink } from "../graph/build";
import type { LifeStatus, MassStatus } from "../graph/types";
import { USER_AGENT } from "../eve/constants";
import { wormholeSizeFromCode } from "./statics";
import type { MapperResult } from "./types";

/**
 * Tripwire has no official/public API. This client mirrors what Short Circuit
 * and the open-source Tripwire fork do: authenticate to get a PHP session
 * cookie, then GET /refresh.php for the current chain. Field semantics are
 * inferred from the open fork and may drift on a given deployment.
 */

interface TripwireSignature {
  id: number | string;
  signatureID?: string;
  systemID: number | string;
  modifiedTime?: string;
}

interface TripwireWormhole {
  initialID: number | string;
  secondaryID: number | string;
  type?: string;
  life?: string; // "stable" | "critical"
  mass?: string; // "stable" | "destab" | "critical"
}

interface TripwireChain {
  signatures?: Record<string, TripwireSignature> | TripwireSignature[];
  wormholes?: Record<string, TripwireWormhole> | TripwireWormhole[];
}

const BLANK_SIGS = new Set(["", "-------", "???", "----", "????"]);

function values<T>(dict: Record<string, T> | T[] | undefined): T[] {
  if (!dict) return [];
  return Array.isArray(dict) ? dict : Object.values(dict);
}

function mapMass(value: string | undefined): MassStatus {
  switch ((value ?? "").toLowerCase()) {
    case "stable":
      return "stable";
    case "destab":
      return "destab";
    case "critical":
      return "critical";
    default:
      return "unknown";
  }
}

function cleanSig(sig: string | undefined): string | undefined {
  if (!sig) return undefined;
  const trimmed = sig.trim();
  return BLANK_SIGS.has(trimmed) ? undefined : trimmed.toUpperCase();
}

/** Pure parse (unit-testable) of a Tripwire chain into graph links. */
export function parseTripwire(chain: TripwireChain, now: number): WormholeLink[] {
  const byId = new Map<string, TripwireSignature>();
  for (const sig of values(chain.signatures)) byId.set(String(sig.id), sig);

  const links: WormholeLink[] = [];
  for (const wh of values(chain.wormholes)) {
    const a = byId.get(String(wh.initialID));
    const b = byId.get(String(wh.secondaryID));
    if (!a || !b) continue;
    const aSys = Number(a.systemID);
    const bSys = Number(b.systemID);
    if (!aSys || !bSys) continue;

    const type = wh.type && !BLANK_SIGS.has(wh.type) ? wh.type.toUpperCase() : undefined;
    const life: LifeStatus = (wh.life ?? "").toLowerCase() === "critical" ? "eol" : "stable";
    const modified = a.modifiedTime ?? b.modifiedTime;
    const ageHours =
      modified && !Number.isNaN(Date.parse(modified))
        ? Math.max(0, (now - Date.parse(modified)) / 3_600_000)
        : undefined;

    links.push({
      a: aSys,
      b: bSys,
      info: {
        size: wormholeSizeFromCode(type),
        mass: mapMass(wh.mass),
        life,
        signatureFrom: cleanSig(a.signatureID),
        signatureTo: cleanSig(b.signatureID),
        wormholeType: type,
        ageHours,
      },
    });
  }
  return links;
}

export interface TripwireCredentials {
  baseUrl: string;
  username: string;
  password: string;
}

/**
 * Log in to a Tripwire instance and return the session cookie string to reuse
 * on subsequent refresh calls.
 */
export async function tripwireLogin(creds: TripwireCredentials): Promise<string> {
  const res = await fetch(`${creds.baseUrl.replace(/\/$/, "")}/login.php`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
      Referer: creds.baseUrl,
    },
    body: new URLSearchParams({
      username: creds.username,
      password: creds.password,
      mode: "login",
    }),
    redirect: "manual",
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  const session = cookies.map((c) => c.split(";")[0]).find((c) => c.startsWith("PHPSESSID="));
  if (!session) {
    throw new Error("Tripwire login failed (no session cookie returned)");
  }
  return session;
}

/** Fetch the current wormhole chain from Tripwire for the given system. */
export async function fetchTripwire(
  baseUrl: string,
  sessionCookie: string,
  systemId: number,
): Promise<MapperResult> {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/refresh.php`);
  url.searchParams.set("mode", "init");
  url.searchParams.set("systemID", String(systemId));

  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT, Cookie: sessionCookie },
  });
  if (res.status === 403) {
    throw new Error("Tripwire session expired or unauthorized (403). Re-connect Tripwire.");
  }
  if (!res.ok) {
    throw new Error(`Tripwire request failed: ${res.status} ${res.statusText}`);
  }
  const chain = (await res.json()) as TripwireChain;
  const now = Date.now();
  const links = parseTripwire(chain, now);
  return {
    source: "tripwire",
    fetchedAt: new Date(now).toISOString(),
    count: links.length,
    links,
  };
}
