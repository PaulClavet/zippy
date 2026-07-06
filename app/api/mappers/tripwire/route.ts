import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { decrypt, encrypt } from "@/lib/crypto";
import {
  fetchTripwire,
  tripwireLogin,
  TripwireLoginError,
  type TripwireCredentials,
} from "@/lib/mappers/tripwire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Jita — a sensible default system to centre the chain on. */
const DEFAULT_CENTER = 30_000_142;

const cookieOpts = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60,
};
// Encrypted credentials persist longer so returning pilots auto-load.
const credsOpts = { ...cookieOpts, maxAge: 60 * 60 * 24 * 30 };

type Store = Awaited<ReturnType<typeof cookies>>;

function persistSession(store: Store, session: string, baseUrl: string) {
  store.set("tripwire_session", session, cookieOpts);
  store.set("tripwire_base", baseUrl, cookieOpts);
}

function readStoredCreds(store: Store): TripwireCredentials | null {
  const enc = store.get("tripwire_creds")?.value;
  if (!enc) return null;
  try {
    return JSON.parse(decrypt(enc)) as TripwireCredentials;
  } catch {
    return null;
  }
}

async function loginAndFetch(store: Store, creds: TripwireCredentials, systemId: number) {
  const session = await tripwireLogin(creds);
  persistSession(store, session, creds.baseUrl);
  return fetchTripwire(creds.baseUrl, session, systemId);
}

/** Report whether a Tripwire connection is remembered (creds or live session). */
export async function GET() {
  const store = await cookies();
  const connected = Boolean(store.get("tripwire_creds")?.value || store.get("tripwire_session")?.value);
  return NextResponse.json({ connected });
}

/**
 * Fetch the Tripwire chain. Send { baseUrl, username, password } to connect
 * (credentials are encrypted and remembered); afterwards an empty body (or just
 * { systemId }) reuses the stored session, re-logging in automatically when the
 * session has expired.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const systemId = Number(body.systemId) || DEFAULT_CENTER;

  const explicit: TripwireCredentials | null =
    body.username && body.password && body.baseUrl
      ? {
          baseUrl: String(body.baseUrl),
          username: String(body.username),
          password: String(body.password),
        }
      : null;

  const store = await cookies();
  const storedCreds = readStoredCreds(store);
  const sessionCookie = store.get("tripwire_session")?.value;
  const baseUrl = store.get("tripwire_base")?.value;

  try {
    // 1. Explicit login: authenticate, remember creds (encrypted), fetch.
    if (explicit) {
      const result = await loginAndFetch(store, explicit, systemId);
      store.set("tripwire_creds", encrypt(JSON.stringify(explicit)), credsOpts);
      return NextResponse.json(result);
    }

    // 2. Reuse a live session; if it has expired, fall through to re-login.
    if (sessionCookie && baseUrl) {
      try {
        return NextResponse.json(await fetchTripwire(baseUrl, sessionCookie, systemId));
      } catch (err) {
        if (!storedCreds) throw err;
      }
    }

    // 3. Re-login from remembered credentials.
    if (storedCreds) {
      return NextResponse.json(await loginAndFetch(store, storedCreds, systemId));
    }

    return NextResponse.json({ error: "not-connected" }, { status: 401 });
  } catch (err) {
    if (err instanceof TripwireLoginError) {
      return NextResponse.json({ error: "tripwire-login", message: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: "tripwire-failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}

/** Disconnect: forget the session and the remembered credentials. */
export async function DELETE() {
  const store = await cookies();
  store.delete("tripwire_session");
  store.delete("tripwire_base");
  store.delete("tripwire_creds");
  return NextResponse.json({ ok: true });
}
