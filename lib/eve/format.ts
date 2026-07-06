import { type SolarSystem, displaySecurity, securityBand } from "../graph/types";

/**
 * EVE's per-0.1-step security status color palette. Values are rounded to the
 * nearest tenth and clamped; anything <= 0.0 is nullsec red.
 */
const SECURITY_COLORS: Record<string, string> = {
  "1.0": "#2FEFEF",
  "0.9": "#48F0C0",
  "0.8": "#00EF47",
  "0.7": "#00F000",
  "0.6": "#8FEF2F",
  "0.5": "#EFEF00",
  "0.4": "#D77700",
  "0.3": "#F06000",
  "0.2": "#F04800",
  "0.1": "#D73000",
};
const NULLSEC_COLOR = "#F00000";

export function securityColor(security: number): string {
  const rounded = Math.round(security * 10) / 10;
  if (rounded <= 0) return NULLSEC_COLOR;
  const clamped = Math.min(1, rounded);
  return SECURITY_COLORS[clamped.toFixed(1)] ?? NULLSEC_COLOR;
}

export { displaySecurity };

/**
 * Normalize a cosmic signature id to EVE's display form — e.g. "abc123" or
 * "abc-123" → "ABC-123". Signatures are 3 letters + 3 digits; anything that
 * doesn't fit that shape is just returned uppercased.
 */
export function formatSignature(sig: string): string {
  const compact = sig.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^[A-Z]{3}[0-9]{3}$/.test(compact)) {
    return `${compact.slice(0, 3)}-${compact.slice(3)}`;
  }
  return sig.trim().toUpperCase();
}

const BAND_LABELS: Record<ReturnType<typeof securityBand>, string> = {
  highsec: "High-sec",
  lowsec: "Low-sec",
  nullsec: "Null-sec",
  wspace: "W-space",
};

export function bandLabel(system: SolarSystem): string {
  return BAND_LABELS[securityBand(system)];
}
