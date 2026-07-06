"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_AGE_THRESHOLD_HOURS,
  DEFAULT_AVOID_SYSTEMS,
  SECURITY_PRESETS,
  WORMHOLE_SIZE_OPTIONS,
  type SecurityPresetKey,
} from "@/lib/eve/constants";
import type { WormholeSize } from "@/lib/graph/types";
import type {
  CharacterDTO,
  MapperResultDTO,
  MetaDTO,
  PlanResponseDTO,
  WormholeLinkDTO,
} from "@/lib/wire";
import { RouteTable } from "./RouteTable";
import { SystemField } from "./SystemField";

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-sky-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

const btn = "rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
const btnPrimary = `${btn} bg-sky-600 text-white hover:bg-sky-500`;
const btnGhost = `${btn} border border-slate-700 text-slate-200 hover:bg-slate-800`;

export function RoutePlanner() {
  const [meta, setMeta] = useState<MetaDTO | null>(null);
  const [character, setCharacter] = useState<CharacterDTO | null>(null);
  const [authBanner, setAuthBanner] = useState<string>("");

  const [source, setSource] = useState("");
  const [dest, setDest] = useState("");

  const [preset, setPreset] = useState<SecurityPresetKey>("shortest");
  const [customWeights, setCustomWeights] = useState(false);
  const [weights, setWeights] = useState({ highsec: 1, lowsec: 1, nullsec: 1, wspace: 1 });

  const [useWormholes, setUseWormholes] = useState(true);
  const [minSize, setMinSize] = useState<WormholeSize>("small");
  const [ignoreEol, setIgnoreEol] = useState(false);
  const [ignoreMassCrit, setIgnoreMassCrit] = useState(false);
  const [ignoreImpossibleAge, setIgnoreImpossibleAge] = useState(true);
  const [ignoreUnidentified, setIgnoreUnidentified] = useState(true);
  const [ignoreStale, setIgnoreStale] = useState(false);
  const [ageHours, setAgeHours] = useState(DEFAULT_AGE_THRESHOLD_HOURS);

  const [useAvoidance, setUseAvoidance] = useState(true);
  const [avoidInput, setAvoidInput] = useState("");
  const [avoidList, setAvoidList] = useState<string[]>([...DEFAULT_AVOID_SYSTEMS]);

  const [chainBySource, setChainBySource] = useState<Record<string, WormholeLinkDTO[]>>({});
  const [mapperMsg, setMapperMsg] = useState("");
  const [mapperBusy, setMapperBusy] = useState(false);
  const [tripwireConnected, setTripwireConnected] = useState(false);
  const [showTripwire, setShowTripwire] = useState(false);
  const [twBase, setTwBase] = useState("https://tw.torpedodelivery.com/");
  const [twUser, setTwUser] = useState("");
  const [twPass, setTwPass] = useState("");

  const [result, setResult] = useState<PlanResponseDTO | null>(null);
  const [routing, setRouting] = useState(false);
  const [waypointMsg, setWaypointMsg] = useState("");

  const chain = useMemo(() => Object.values(chainBySource).flat(), [chainBySource]);
  const chainCount = chain.length;

  useEffect(() => {
    fetch("/api/meta").then((r) => r.json()).then(setMeta).catch(() => {});
    fetch("/api/esi/me").then((r) => r.json()).then((d) => setCharacter(d.character)).catch(() => {});
    const auth = new URLSearchParams(window.location.search).get("auth");
    if (auth === "ok") setAuthBanner("Signed in to EVE.");
    else if (auth) setAuthBanner("EVE sign-in failed. Please try again.");
    if (auth) window.history.replaceState({}, "", window.location.pathname);
    // Auto-load the zero-setup public wormhole chain on first visit.
    loadEveScout();
    // If Tripwire is remembered, auto-load that chain too (zero clicks).
    fetch("/api/mappers/tripwire")
      .then((r) => r.json())
      .then((d) => {
        if (d.connected) {
          setTripwireConnected(true);
          autoLoadTripwire();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wingspan pilots use their in-game name as the Tripwire username — prefill it.
  useEffect(() => {
    if (character?.name) setTwUser((u) => u || character.name);
  }, [character]);

  async function runRoute() {
    setRouting(true);
    setWaypointMsg("");
    try {
      const body = {
        from: source,
        to: dest,
        useWormholes,
        securityPrio: customWeights ? weights : SECURITY_PRESETS[preset].prio,
        wormholes: {
          minSize,
          allowEol: !ignoreEol,
          allowMassCritical: !ignoreMassCrit,
          maxAgeHours: ignoreStale ? ageHours : undefined,
          dropImpossibleAge: ignoreImpossibleAge,
          dropUnidentified: ignoreUnidentified,
        },
        avoid: useAvoidance ? avoidList : [],
        chain,
      };
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setResult((await res.json()) as PlanResponseDTO);
    } catch (err) {
      setResult({ ok: false, code: "error", error: String(err) });
    } finally {
      setRouting(false);
    }
  }

  async function loadEveScout() {
    setMapperBusy(true);
    setMapperMsg("");
    try {
      const res = await fetch("/api/mappers/evescout");
      const data = (await res.json()) as MapperResultDTO;
      if (!res.ok) throw new Error(data.message ?? data.error ?? "failed");
      setChainBySource((s) => ({ ...s, "eve-scout": data.links }));
      setMapperMsg(`Loaded ${data.count} Thera/Turnur holes from Eve-Scout.`);
    } catch (err) {
      setMapperMsg(`Eve-Scout failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setMapperBusy(false);
    }
  }

  async function autoLoadTripwire() {
    try {
      const res = await fetch("/api/mappers/tripwire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        // Remembered creds stopped working (e.g. password changed) — prompt reconnect.
        if (res.status === 401) {
          setTripwireConnected(false);
          setMapperMsg("Tripwire needs reconnecting.");
        }
        return;
      }
      const data = (await res.json()) as MapperResultDTO;
      setChainBySource((s) => ({ ...s, tripwire: data.links }));
      setTripwireConnected(true);
      setMapperMsg(`Auto-loaded ${data.count} holes from Tripwire.`);
    } catch {
      /* silent — pilot can still connect manually */
    }
  }

  async function disconnectTripwire() {
    await fetch("/api/mappers/tripwire", { method: "DELETE" });
    setTripwireConnected(false);
    setChainBySource((s) => {
      const next = { ...s };
      delete next.tripwire;
      return next;
    });
    setMapperMsg("Tripwire disconnected.");
  }

  async function connectTripwire() {
    setMapperBusy(true);
    setMapperMsg("");
    try {
      // Center the chain on the source system (Tripwire needs a systemID); this
      // reuses the search API to resolve a name to an id.
      const centre = source.trim() || "Jita";
      const hit = await fetch(`/api/systems/search?q=${encodeURIComponent(centre)}`)
        .then((r) => r.json())
        .then((d) => d.systems?.[0]);
      if (!hit) throw new Error(`Could not resolve system "${centre}" to centre the chain on.`);
      const res = await fetch("/api/mappers/tripwire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: twBase, username: twUser, password: twPass, systemId: hit.id }),
      });
      const data = (await res.json()) as MapperResultDTO;
      if (!res.ok) throw new Error(data.message ?? data.error ?? "failed");
      setChainBySource((s) => ({ ...s, tripwire: data.links }));
      setMapperMsg(`Loaded ${data.count} holes from Tripwire.`);
      setTwPass("");
      setTripwireConnected(true);
      setShowTripwire(false);
    } catch (err) {
      setMapperMsg(`Tripwire failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setMapperBusy(false);
    }
  }

  function resetChain() {
    setChainBySource({});
    setMapperMsg("Chain cleared.");
  }

  async function useMyLocation() {
    try {
      const res = await fetch("/api/esi/location");
      const data = await res.json();
      if (res.ok) setSource(data.systemName);
      else setWaypointMsg(data.message ?? "Could not read location.");
    } catch (err) {
      setWaypointMsg(String(err));
    }
  }

  async function setInEve() {
    if (!result?.ok) return;
    setWaypointMsg("Setting waypoints…");
    try {
      const res = await fetch("/api/esi/waypoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemIds: result.waypoints }),
      });
      const data = await res.json();
      if (res.ok) setWaypointMsg(`Set ${data.set} in-game waypoint(s). Jump wormholes manually.`);
      else setWaypointMsg(data.message ?? "Could not set waypoints.");
    } catch (err) {
      setWaypointMsg(String(err));
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setCharacter(null);
  }

  const addAvoid = () => {
    const v = avoidInput.trim();
    if (v && !avoidList.includes(v)) setAvoidList((l) => [...l, v]);
    setAvoidInput("");
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: route planner */}
      <div className="space-y-4 lg:col-span-2">
        {authBanner && (
          <div className="rounded-md border border-sky-800 bg-sky-950/40 px-3 py-2 text-sm text-sky-200">
            {authBanner}
          </div>
        )}

        {meta?.sde.isDemo && (
          <div className="rounded-md border border-amber-800 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
            Demo map (9 systems). Run <code className="font-mono">pnpm sde:build</code> to load the full
            EVE universe (~8,490 systems).
          </div>
        )}

        <Section title="Route">
          <div className="space-y-3">
            <SystemField
              label="Source"
              value={source}
              onChange={setSource}
              placeholder="e.g. Jita"
              accessory={
                character ? (
                  <button type="button" className={btnGhost} onClick={useMyLocation} title="Use my in-game location">
                    📍
                  </button>
                ) : undefined
              }
            />
            <SystemField label="Destination" value={dest} onChange={setDest} placeholder="e.g. Amarr" />
            <div className="flex items-center gap-3">
              <button type="button" className={btnPrimary} onClick={runRoute} disabled={routing || !source || !dest}>
                {routing ? "Routing…" : "Find route"}
              </button>
              {result?.ok && (
                <span className="text-sm text-slate-300">
                  <b className="text-slate-100">{result.summary.jumps}</b> jumps ·{" "}
                  {result.summary.gateJumps} gates · {result.summary.wormholeJumps} wormholes
                </span>
              )}
            </div>
          </div>
        </Section>

        {result && !result.ok && (
          <div className="rounded-md border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
            {result.error}
          </div>
        )}

        {result?.ok && (
          <>
            <RouteTable steps={result.steps} tripwireBase={twBase} />
            <Section
              title="Fleet format"
              right={
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => navigator.clipboard?.writeText(result.fleet)}
                >
                  Copy
                </button>
              }
            >
              <code className="block break-words rounded bg-slate-950/70 p-3 font-mono text-xs text-emerald-300">
                {result.fleet}
              </code>
              {character && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" className={btnGhost} onClick={setInEve}>
                    Set destination in EVE
                  </button>
                  {waypointMsg && <span className="text-xs text-slate-400">{waypointMsg}</span>}
                </div>
              )}
            </Section>
          </>
        )}
      </div>

      {/* Right: options */}
      <div className="space-y-4">
        <Section title="EVE account">
          {meta && !meta.sso ? (
            <p className="text-sm text-slate-400">
              Sign-in not configured. Set <code className="text-slate-300">EVE_CLIENT_ID</code> /
              <code className="text-slate-300"> SECRET</code> to enable location &amp; autopilot.
            </p>
          ) : character ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-200">Signed in as <b>{character.name}</b></span>
              <button type="button" className={btnGhost} onClick={logout}>
                Log out
              </button>
            </div>
          ) : (
            <a className={btnPrimary} href="/api/auth/login">
              Log in with EVE
            </a>
          )}
        </Section>

        <Section
          title="Wormhole sources"
          right={
            chainCount > 0 ? (
              <button type="button" className="text-xs text-slate-400 hover:text-slate-200" onClick={resetChain}>
                Reset chain
              </button>
            ) : undefined
          }
        >
          <div className="space-y-3">
            <button type="button" className={`${btnGhost} w-full`} onClick={loadEveScout} disabled={mapperBusy}>
              {mapperBusy ? "Loading…" : "Reload public holes (Eve-Scout)"}
            </button>

            {tripwireConnected ? (
              <div className="flex items-center justify-between rounded-md border border-emerald-900 bg-emerald-950/30 px-3 py-2">
                <span className="text-sm text-emerald-300">✓ Tripwire connected — auto-loads on visit</span>
                <button type="button" className="text-xs text-slate-400 hover:text-rose-300" onClick={disconnectTripwire}>
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="rounded-md border border-fuchsia-700/60 bg-fuchsia-950/25 p-3">
                <p className="text-sm font-semibold text-fuchsia-200">🪱 Connect your Wingspan Tripwire</p>
                <p className="mt-1 text-xs text-slate-300">
                  Route through the corp&apos;s live wormhole chain. Enter your Tripwire password once — it&apos;s
                  stored encrypted and auto-loads on every visit.
                </p>
                <button type="button" className={`${btnPrimary} mt-3 w-full`} onClick={() => setShowTripwire((v) => !v)}>
                  {showTripwire ? "Hide" : "Connect Tripwire"}
                </button>

                {showTripwire && (
                  <div className="mt-3 space-y-2">
                    <details className="rounded border border-slate-700 bg-slate-900/60 p-2 text-xs text-slate-300" open>
                      <summary className="cursor-pointer font-medium text-slate-200">
                        No Tripwire account yet? Set one up ↓
                      </summary>
                      <ol className="mt-2 list-decimal space-y-1 pl-4">
                        <li>
                          Go to{" "}
                          <a className="text-sky-400 underline" href="https://tw.torpedodelivery.com" target="_blank" rel="noreferrer">
                            tw.torpedodelivery.com
                          </a>{" "}
                          and log in with EVE.
                        </li>
                        <li>Gear (top-right) → <b>Account Settings</b>.</li>
                        <li><b>Change Username</b> → set it to your <b>in-game name</b> → Save.</li>
                        <li><b>Change Password</b> → pick a password (<b>not</b> your EVE password) → Save.</li>
                        <li>Enter that username &amp; password below.</li>
                      </ol>
                    </details>

                    <input
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                      value={twUser}
                      onChange={(e) => setTwUser(e.target.value)}
                      placeholder="Tripwire username (your in-game name)"
                      autoComplete="off"
                    />
                    <input
                      type="password"
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                      value={twPass}
                      onChange={(e) => setTwPass(e.target.value)}
                      placeholder="Tripwire password"
                      autoComplete="off"
                    />
                    <details className="text-[11px] text-slate-500">
                      <summary className="cursor-pointer">Using a different Tripwire? Change the URL</summary>
                      <input
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                        value={twBase}
                        onChange={(e) => setTwBase(e.target.value)}
                        placeholder="Tripwire URL"
                      />
                    </details>
                    <button
                      type="button"
                      className={`${btnPrimary} w-full`}
                      onClick={connectTripwire}
                      disabled={mapperBusy || !twUser || !twPass}
                    >
                      {mapperBusy ? "Connecting…" : "Connect & fetch chain"}
                    </button>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      <b className="text-slate-300">How this is saved:</b> Tripwire logs in with
                      username/password only — no API token — so Zippy keeps your Tripwire password
                      to auto-refresh the chain. It&apos;s encrypted (AES-256-GCM) and held in a
                      cookie in your browser; only the Zippy server can decrypt it. That&apos;s
                      weaker than a token sign-in — an accepted trade-off — so use a{" "}
                      <b>Tripwire-only password</b>, never your EVE one.
                    </p>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-slate-400">
              {chainCount > 0
                ? `${chainCount} live wormhole connections loaded.`
                : "No live wormholes loaded — gate-only routing."}
            </p>
            {mapperMsg && <p className="text-xs text-slate-500">{mapperMsg}</p>}
          </div>
        </Section>

        <Section title="Security preference">
          <select
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
            value={preset}
            onChange={(e) => setPreset(e.target.value as SecurityPresetKey)}
            disabled={customWeights}
          >
            {Object.entries(SECURITY_PRESETS).map(([key, p]) => (
              <option key={key} value={key}>
                {p.label} — {p.description}
              </option>
            ))}
          </select>
          <div className="mt-3">
            <Check label="Custom weights (1–100, lower = preferred)" checked={customWeights} onChange={setCustomWeights} />
            {customWeights && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {(["highsec", "lowsec", "nullsec", "wspace"] as const).map((band) => (
                  <label key={band} className="text-center text-xs text-slate-400">
                    {band.slice(0, 2).toUpperCase()}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-1 py-1 text-center text-sm text-slate-100"
                      value={weights[band]}
                      onChange={(e) => setWeights((w) => ({ ...w, [band]: Number(e.target.value) || 1 }))}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="Wormhole restrictions">
          <div className="space-y-2">
            <Check label="Use wormholes" checked={useWormholes} onChange={setUseWormholes} />
            {useWormholes && (
              <>
                <label className="block text-sm text-slate-300">
                  Minimum size
                  <select
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                    value={minSize}
                    onChange={(e) => setMinSize(e.target.value as WormholeSize)}
                  >
                    {WORMHOLE_SIZE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Check label="Ignore end-of-life holes" checked={ignoreEol} onChange={setIgnoreEol} />
                <Check label="Ignore mass-critical holes" checked={ignoreMassCrit} onChange={setIgnoreMassCrit} />
                <Check
                  label="Ignore ghost sigs (age > 24h)"
                  checked={ignoreImpossibleAge}
                  onChange={setIgnoreImpossibleAge}
                />
                <Check
                  label="Ignore unidentified holes (no type/ID)"
                  checked={ignoreUnidentified}
                  onChange={setIgnoreUnidentified}
                />
                <div className="flex items-center gap-2">
                  <Check label="Ignore holes older than" checked={ignoreStale} onChange={setIgnoreStale} />
                  <input
                    type="number"
                    min={1}
                    max={48}
                    className="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm disabled:opacity-40"
                    value={ageHours}
                    disabled={!ignoreStale}
                    onChange={(e) => setAgeHours(Number(e.target.value) || DEFAULT_AGE_THRESHOLD_HOURS)}
                  />
                  <span className="text-sm text-slate-400">h</span>
                </div>
              </>
            )}
          </div>
        </Section>

        <Section
          title="Avoidance"
          right={<Check label="Use list" checked={useAvoidance} onChange={setUseAvoidance} />}
        >
          <div className={useAvoidance ? "" : "pointer-events-none opacity-40"}>
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
                value={avoidInput}
                onChange={(e) => setAvoidInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAvoid())}
                placeholder="System to avoid"
              />
              <button type="button" className={btnGhost} onClick={addAvoid}>
                +
              </button>
            </div>
            {avoidList.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {avoidList.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-rose-900/50"
                      onClick={() => setAvoidList((l) => l.filter((x) => x !== s))}
                      title="Remove"
                    >
                      {s} ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Zarzakh is avoided by default — remove it to route through. (You can still route
              directly to any avoided system.)
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}
