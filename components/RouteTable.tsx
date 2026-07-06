"use client";

import { displaySecurity, securityColor } from "@/lib/eve/format";
import type { RouteStepDTO } from "@/lib/wire";

export function RouteTable({ steps }: { steps: RouteStepDTO[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-900/80 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">System</th>
            <th className="px-3 py-2 font-medium">Instruction</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <tr
              key={step.index}
              className="border-t border-slate-800 odd:bg-slate-900/30"
            >
              <td className="px-3 py-2 align-top font-mono text-xs text-slate-500">
                {step.index === 0 ? "–" : step.index}
              </td>
              <td className="px-3 py-2 align-top">
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: securityColor(step.security) }}
                    title={`Security ${displaySecurity(step.security)}`}
                  />
                  <span className="font-medium text-slate-100">{step.systemName}</span>
                  <span
                    className="font-mono text-xs"
                    style={{ color: securityColor(step.security) }}
                  >
                    {displaySecurity(step.security)}
                  </span>
                  {step.regionName && (
                    <span className="text-xs text-slate-500">· {step.regionName}</span>
                  )}
                </span>
              </td>
              <td className="px-3 py-2 align-top text-slate-300">
                <span className="flex flex-wrap items-center gap-2">
                  {step.connectionType === "wormhole" ? (
                    <span className="rounded bg-fuchsia-600/20 px-1.5 py-0.5 font-mono text-xs text-fuchsia-300">
                      ~ WH {step.wormholeType ?? ""} {step.signature ?? ""}
                    </span>
                  ) : step.connectionType === "gate" ? (
                    <span className="rounded bg-sky-600/20 px-1.5 py-0.5 font-mono text-xs text-sky-300">
                      → gate
                    </span>
                  ) : (
                    <span className="rounded bg-slate-700/40 px-1.5 py-0.5 font-mono text-xs text-slate-300">
                      start
                    </span>
                  )}
                  <span>{step.instruction}</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
