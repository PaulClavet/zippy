import { USER_AGENT } from "../eve/constants";
import { ESI_BASE, SSO_TOKEN, clientId, clientSecret } from "./config";

/** Thrown on 403 from ESI: usually a missing scope or the character is offline. */
export class EsiAuthError extends Error {}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

function basicAuth(): string {
  return Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64");
}

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(SSO_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`,
      "User-Agent": USER_AGENT,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`SSO token request failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

export function exchangeCode(code: string): Promise<TokenResponse> {
  return tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code }));
}

export function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
  );
}

export interface EsiLocation {
  solar_system_id: number;
  station_id?: number;
  structure_id?: number;
}

export async function getLocation(accessToken: string, characterId: number): Promise<EsiLocation> {
  const res = await fetch(`${ESI_BASE}/characters/${characterId}/location/`, {
    headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": USER_AGENT },
  });
  if (res.status === 403) throw new EsiAuthError("Missing scope or character not signed in.");
  if (!res.ok) throw new Error(`ESI location failed: ${res.status}`);
  return (await res.json()) as EsiLocation;
}

/** Set a single autopilot waypoint. */
export async function setWaypoint(
  accessToken: string,
  destinationId: number,
  clearOthers: boolean,
): Promise<void> {
  const url = new URL(`${ESI_BASE}/ui/autopilot/waypoint/`);
  url.searchParams.set("destination_id", String(destinationId));
  url.searchParams.set("clear_other_waypoints", String(clearOthers));
  url.searchParams.set("add_to_beginning", "false");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": USER_AGENT },
  });
  if (res.status === 403) {
    throw new EsiAuthError("Character offline or missing scope — make sure EVE is running.");
  }
  if (!res.ok && res.status !== 204) {
    throw new Error(`Set waypoint failed: ${res.status}`);
  }
}

/**
 * Breadcrumb a whole route into the in-game autopilot: the first system clears
 * the existing route, the rest append in order. Done sequentially because ESI
 * preserves insertion order and parallel calls race. `systemIds` should be the
 * K-space anchor systems along the route (wormhole exits aren't valid
 * waypoints, so the pilot jumps those manually).
 */
export async function setWaypoints(accessToken: string, systemIds: number[]): Promise<number> {
  let set = 0;
  for (let i = 0; i < systemIds.length; i++) {
    await setWaypoint(accessToken, systemIds[i], i === 0);
    set++;
  }
  return set;
}
