import { cookies } from "next/headers";
import { refreshTokens } from "./client";
import { characterIdFromToken, characterNameFromToken } from "./token";

/** Server-side EVE session, persisted in an httpOnly cookie. */
export interface EsiSession {
  access: string;
  refresh: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  characterId: number;
  characterName?: string;
}

const COOKIE = "esi_session";
const REFRESH_SLACK_MS = 60_000;

export async function readSession(): Promise<EsiSession | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EsiSession;
  } catch {
    return null;
  }
}

export async function writeSession(session: EsiSession): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export function sessionFromToken(token: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}): EsiSession {
  return {
    access: token.access_token,
    refresh: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    characterId: characterIdFromToken(token.access_token) ?? 0,
    characterName: characterNameFromToken(token.access_token),
  };
}

/**
 * Return a session with a fresh (non-expired) access token, refreshing and
 * re-persisting if it's within the slack window. Returns null if not logged in.
 */
export async function getValidSession(): Promise<EsiSession | null> {
  const session = await readSession();
  if (!session) return null;
  if (Date.now() < session.expiresAt - REFRESH_SLACK_MS) return session;

  const token = await refreshTokens(session.refresh);
  const refreshed: EsiSession = {
    access: token.access_token,
    // Refresh tokens can rotate — keep the new one if returned, else reuse.
    refresh: token.refresh_token ?? session.refresh,
    expiresAt: Date.now() + token.expires_in * 1000,
    characterId: characterIdFromToken(token.access_token) ?? session.characterId,
    characterName: characterNameFromToken(token.access_token) ?? session.characterName,
  };
  await writeSession(refreshed);
  return refreshed;
}
