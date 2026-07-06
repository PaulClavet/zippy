"use client";

import { displaySecurity, securityColor } from "@/lib/eve/format";
import type { RouteStepDTO, WormholeDetailsDTO } from "@/lib/wire";

function hrs(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}h`;
}

function tripwireUrl(base: string, systemName: string): string {
  const clean = base.replace(/\/+$/, "");
  return `${clean}/?system=${encodeURIComponent(systemName)}`;
}

const MASS_COLOR: Record<string, string> = {
  stable: "text-emerald-300",
  destab: "text-amber-300",
  critical: "text-rose-300",
  unknown: "text-slate-400",
};

function Chip({ children, title, className = "" }: { children: React.ReactNode; title?: string; className?: string }) {
  return (
    <span
      title={title}
      className={`rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[11px] ${className}`}
    >
      {children}
    </span>
  );
}

function WormholeChips({ wh }: { wh: WormholeDetailsDTO }) {
  // Prefer a reported estimate; otherwise the discovery-age upper bound.
  const timeLeft =
    wh.estimatedHoursLeft != null
      ? { label: `~${hrs(wh.estimatedHoursLeft)} left`, title: "Reported time remaining" }
      : wh.maxHoursLeft != null
        ? { label: `≤${hrs(wh.maxHoursLeft)} left`, title: "Maximum possible time left, from discovery age" }
        : null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1 text-slate-300">
      {wh.type && <Chip title="Wormhole type" className="text-fuchsia-300">{wh.type}</Chip>}
      {wh.size !== "unknown" && <Chip title="Maximum ship size">{wh.size}</Chip>}
      <Chip title="Mass status" className={MASS_COLOR[wh.mass] ?? "text-slate-400"}>
        mass: {wh.mass}
      </Chip>
      <Chip title="Lifetime status" className={wh.life === "eol" ? "text-rose-300" : "text-emerald-300"}>
        {wh.life === "eol" ? "end-of-life" : "life: stable"}
      </Chip>
      {wh.ageHours != null && <Chip title="Time since discovery">found {hrs(wh.ageHours)} ago</Chip>}
      {timeLeft && (
        <Chip title={timeLeft.title} className="text-sky-300">
          {timeLeft.label}
        </Chip>
      )}
      {wh.returnSignature && <Chip title="Return signature (far side)">return {wh.returnSignature}</Chip>}
    </div>
  );
}

export function RouteTable({ steps, tripwireBase }: { steps: RouteStepDTO[]; tripwireBase: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2 font-medium">System</th>
            <th className="px-3 py-2 font-medium">In this system</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <tr key={step.index} className="border-t border-slate-800 odd:bg-slate-900/30">
              <td className="px-3 py-2 align-top">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: securityColor(step.security) }}
                    title={`Security ${displaySecurity(step.security)}`}
                  />
                  <a
                    className="font-medium text-slate-100 underline decoration-dotted decoration-slate-600 underline-offset-2 hover:text-sky-300"
                    href={tripwireUrl(tripwireBase, step.systemName)}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in Tripwire"
                  >
                    {step.systemName}
                  </a>
                  <span className="font-mono text-xs" style={{ color: securityColor(step.security) }}>
                    {displaySecurity(step.security)}
                  </span>
                </span>
                {step.regionName && (
                  <span className="mt-0.5 block pl-[18px] text-xs text-slate-500">{step.regionName}</span>
                )}
              </td>
              <td className="px-3 py-2 align-top text-slate-300">
                <span className="flex items-start gap-2">
                  {step.via === "wormhole" ? (
                    <span className="mt-0.5 rounded bg-fuchsia-600/20 px-1.5 py-0.5 text-xs text-fuchsia-300">WH</span>
                  ) : step.via === "gate" ? (
                    <span className="mt-0.5 rounded bg-sky-600/20 px-1.5 py-0.5 text-xs text-sky-300">gate</span>
                  ) : (
                    <span className="mt-0.5 rounded bg-emerald-600/20 px-1.5 py-0.5 text-xs text-emerald-300">◎</span>
                  )}
                  <span>{step.action}</span>
                </span>
                {step.via === "wormhole" && step.wormhole && <WormholeChips wh={step.wormhole} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
