import { cookies } from "next/headers";
import { decrypt } from "../crypto";
import { tripwireLogin, type TripwireCredentials } from "./tripwire";

const cookieOpts = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60,
};

type Store = Awaited<ReturnType<typeof cookies>>;

function readStoredCreds(store: Store): TripwireCredentials | null {
  const enc = store.get("tripwire_creds")?.value;
  if (!enc) return null;
  try {
    return JSON.parse(decrypt(enc)) as TripwireCredentials;
  } catch {
    return null;
  }
}

/**
 * Run `fn` with a working Tripwire (baseUrl + session cookie). Uses the stored
 * session, transparently re-logging in from remembered credentials if it's
 * missing or has expired. Returns null when Tripwire isn't connected at all.
 */
export async function withTripwireSession<T>(
  fn: (baseUrl: string, sessionCookie: string) => Promise<T>,
): Promise<T | null> {
  const store = await cookies();
  const creds = readStoredCreds(store);
  const baseUrl = store.get("tripwire_base")?.value;
  const cookie = store.get("tripwire_session")?.value;

  if (baseUrl && cookie) {
    try {
      return await fn(baseUrl, cookie);
    } catch (err) {
      if (!creds) throw err; // no way to recover — surface it
    }
  }

  if (!creds) return null; // not connected
  const fresh = await tripwireLogin(creds);
  store.set("tripwire_session", fresh, cookieOpts);
  store.set("tripwire_base", creds.baseUrl, cookieOpts);
  return fn(creds.baseUrl, fresh);
}
