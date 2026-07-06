"use client";

import { useEffect, useRef, useState } from "react";
import { displaySecurity, securityColor } from "@/lib/eve/format";
import type { SystemHit } from "@/lib/wire";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  accessory?: React.ReactNode;
}

export function SystemField({ label, value, onChange, placeholder, accessory }: Props) {
  const [hits, setHits] = useState<SystemHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const q = value.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/systems/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setHits(data.systems ?? []);
        setActive(0);
      } catch {
        setHits([]);
      }
    }, 150);
    return () => clearTimeout(t);
  }, [value, open]);

  const choose = (hit: SystemHit) => {
    onChange(hit.name);
    setOpen(false);
    setHits([]);
  };

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          className="w-full rounded-md border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={(e) => {
            if (!open || hits.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(hits[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {accessory}
      </div>
      {open && hits.length > 0 && (
        <ul
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-700 bg-slate-900 shadow-xl"
          onMouseDown={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
          }}
        >
          {hits.map((hit, i) => (
            <li key={hit.id}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  i === active ? "bg-sky-600/30" : "hover:bg-slate-800"
                }`}
                onClick={() => choose(hit)}
              >
                <span
                  className="font-mono text-xs"
                  style={{ color: securityColor(hit.security) }}
                >
                  {displaySecurity(hit.security)}
                </span>
                <span className="text-slate-100">{hit.name}</span>
                {hit.regionName && (
                  <span className="ml-auto text-xs text-slate-500">{hit.regionName}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
