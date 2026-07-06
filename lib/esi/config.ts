export const SSO_AUTHORIZE = "https://login.eveonline.com/v2/oauth/authorize";
export const SSO_TOKEN = "https://login.eveonline.com/v2/oauth/token";
export const ESI_BASE = "https://esi.evetech.net/latest";

/** Scopes Zippy requests: read current location, and write autopilot waypoints. */
export const ESI_SCOPES = ["esi-location.read_location.v1", "esi-ui.write_waypoint.v1"];

export function clientId(): string {
  return process.env.EVE_CLIENT_ID ?? "";
}
export function clientSecret(): string {
  return process.env.EVE_CLIENT_SECRET ?? "";
}
export function callbackUrl(): string {
  return process.env.EVE_CALLBACK_URL ?? "http://localhost:3000/api/auth/callback";
}

/** Whether EVE SSO is configured (login features can be enabled). */
export function ssoConfigured(): boolean {
  return clientId().length > 0 && clientSecret().length > 0;
}

/**
 * The public origin (scheme + host) Zippy is served from, derived from the
 * registered callback URL. Used to build post-login redirects so they land on
 * the real public host when running behind a reverse proxy / Tailscale Funnel,
 * not the internal request origin (e.g. localhost:3000).
 */
export function publicOrigin(): string {
  try {
    return new URL(callbackUrl()).origin;
  } catch {
    return "http://localhost:3000";
  }
}
