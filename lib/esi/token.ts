/**
 * Minimal JWT handling for EVE SSO access tokens. We decode the payload to read
 * the character id/name/scopes and expiry. Signature verification against the
 * SSO JWKS is a future hardening step (tokens arrive over TLS straight from the
 * OAuth exchange, so payload-trust is acceptable for now).
 */
export interface JwtPayload {
  sub?: string; // "CHARACTER:EVE:<id>"
  name?: string;
  scp?: string | string[];
  exp?: number;
  iss?: string;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as JwtPayload;
  } catch {
    return null;
  }
}

export function characterIdFromToken(token: string): number | null {
  const sub = decodeJwt(token)?.sub;
  if (!sub) return null;
  const id = Number(sub.split(":").pop());
  return Number.isFinite(id) ? id : null;
}

export function characterNameFromToken(token: string): string | undefined {
  return decodeJwt(token)?.name;
}

export function scopesFromToken(token: string): string[] {
  const scp = decodeJwt(token)?.scp;
  if (!scp) return [];
  return Array.isArray(scp) ? scp : scp.split(" ");
}
