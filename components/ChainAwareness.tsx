"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CharacterDTO, TrackedPilotDTO, TrackingResponseDTO } from "@/lib/wire";
import { SystemField } from "./SystemField";

type Trend = "new" | "inbound" | "outbound" | "same";
interface Row extends TrackedPilotDTO {
  trend: Trend;
}

const POLL_MS = 10000;

function tripwireUrl(base: string, systemName: string): string {
  return `${base.replace(/\/+$/, "")}/?system=${encodeURIComponent(systemName)}`;
}

const TREND: Record<Trend, { icon: string; className: string; title: string }> = {
  inbound: { icon: "▼", className: "text-emerald-400", title: "Getting closer" },
  outbound: { icon: "▲", className: "text-slate-500", title: "Moving away" },
  same: { icon: "·", className: "text-slate-600", title: "Holding" },
  new: { icon: "•", className: "text-sky-400", title: "Newly seen" },
};

export function ChainAwareness({
  tripwireConnected,
  character,
  defaultFocus,
  tripwireBase,
}: {
  tripwireConnected: boolean;
  character: CharacterDTO | null;
  defaultFocus: string;
  tripwireBase: string;
}) {
  const [focus, setFocus] = useState(defaultFocus);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<{ count: number; truncated: boolean; updatedAt: number } | null>(null);
  const [error, setError] = useState("");
  const [hideIdle, setHideIdle] = useState(true);
  const [idleMin, setIdleMin] = useState(15);
  const prev = useRef<Map<string, number>>(new Map());

  // Reset the movement baseline whenever the focus changes.
  useEffect(() => {
    prev.current = new Map();
    setRows(null);
    setMeta(null);
  }, [focus]);

  const load = useCallback(async () => {
    const f = focus.trim();
    if (!f || !tripwireConnected) return;
    try {
      const res = await fetch(`/api/tracking?focus=${encodeURIComponent(f)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "failed");
        return;
      }
      const d = data as TrackingResponseDTO;
      const next = new Map<string, number>();
      const rws: Row[] = d.pilots.map((p) => {
        next.set(p.name, p.jumps);
        const pj = prev.current.get(p.name);
        const trend: Trend =
          pj === undefined ? "new" : p.jumps < pj ? "inbound" : p.jumps > pj ? "outbound" : "same";
        return { ...p, trend };
      });
      prev.current = next;
      setRows(rws);
      setMeta({ count: d.count, truncated: d.truncated, updatedAt: Date.now() });
      setError("");
    } catch (e) {
      setError(String(e));
    }
  }, [focus, tripwireConnected]);

  useEffect(() => {
    if (!tripwireConnected || !focus.trim()) return;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load, tripwireConnected, focus]);

  async function useMyLocation() {
    try {
      const res = await fetch("/api/esi/location");
      const data = await res.json();
      if (res.ok) setFocus(data.systemName);
    } catch {
      /* ignore */
    }
  }

  const shown = rows ? (hideIdle ? rows.filter((r) => r.idleMinutes < idleMin) : rows) : null;
  const hiddenCount = rows ? rows.length - (shown?.length ?? 0) : 0;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Chain awareness
        </h2>
        {meta && (
          <span className="text-xs text-slate-500">
            {meta.count} pilot{meta.count === 1 ? "" : "s"}
            {meta.truncated ? " (nearest 50)" : ""}
          </span>
        )}
      </div>

      {!tripwireConnected ? (
        <p className="text-sm text-slate-400">
          Connect Tripwire (in Wormhole sources) to see who&apos;s in the chain, in what, and how
          many jumps out — wormholes included.
        </p>
      ) : (
        <>
          <SystemField
            label="Focus system (jumps measured to here)"
            value={focus}
            onChange={setFocus}
            placeholder="e.g. your staging system"
            accessory={
              character ? (
                <button
                  type="button"
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  onClick={useMyLocation}
                  title="Use my in-game location"
                >
                  📍
                </button>
              ) : undefined
            }
          />

          {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

          <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-sky-500"
              checked={hideIdle}
              onChange={(e) => setHideIdle(e.target.checked)}
            />
            Hide idle pilots (no move in
            <input
              type="number"
              min={1}
              max={120}
              className="w-14 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-center text-slate-200 disabled:opacity-40"
              value={idleMin}
              disabled={!hideIdle}
              onChange={(e) => setIdleMin(Number(e.target.value) || 15)}
            />
            min) — likely logged off, but may just be parked
            {hiddenCount > 0 && <span className="text-slate-500">· {hiddenCount} hidden</span>}
          </label>

          {shown && shown.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-2 py-2 font-medium" />
                    <th className="px-3 py-2 font-medium">Pilot</th>
                    <th className="px-3 py-2 font-medium">Ship</th>
                    <th className="px-3 py-2 font-medium">System</th>
                    <th className="px-3 py-2 text-right font-medium">Jumps</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr
                      key={`${r.name}-${i}`}
                      className={`border-t border-slate-800 ${
                        r.trend === "inbound" ? "bg-emerald-950/30" : "odd:bg-slate-900/30"
                      }`}
                    >
                      <td className={`px-2 py-1.5 text-center ${TREND[r.trend].className}`} title={TREND[r.trend].title}>
                        {TREND[r.trend].icon}
                      </td>
                      <td className="px-3 py-1.5 font-medium text-slate-100">
                        {r.name}
                        {r.idleMinutes >= 5 && (
                          <span
                            className="ml-2 rounded bg-slate-800 px-1 py-0.5 font-mono text-[10px] text-slate-500"
                            title="Minutes since this pilot last changed system"
                          >
                            idle {r.idleMinutes}m
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-slate-300">{r.ship}</td>
                      <td className="px-3 py-1.5">
                        <a
                          className="text-slate-300 underline decoration-dotted decoration-slate-600 underline-offset-2 hover:text-sky-300"
                          href={tripwireUrl(tripwireBase, r.systemName)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {r.systemName}
                        </a>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-200">
                        {r.jumps === 0 ? "here" : r.jumps}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              {focus.trim()
                ? "No tracked pilots in the chain yet. (Pilots must have Tripwire open with location sharing on.)"
                : "Set a focus system to measure distances from."}
            </p>
          )}
          <p className="mt-2 text-[11px] text-slate-600">
            Live every 10s. <span className="text-emerald-400">▼</span> inbound ·{" "}
            <span className="text-slate-500">▲</span> moving away. Tripwire shares no online status, so
            &ldquo;idle&rdquo; is inferred from movement (a logged-off pilot who left Tripwire open never
            moves). Pilots who hide in Tripwire aren&apos;t shown.
          </p>
        </>
      )}
    </section>
  );
}
