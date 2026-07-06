import type { SecurityPrio } from "../graph/pathfinder";
import type { WormholeSize } from "../graph/types";

/**
 * Zarzakh — the special Triglavian/Jove system. Short Circuit auto-avoids it
 * unless it is explicitly the source or destination, because you can't route
 * through it normally.
 */
export const ZARZAKH_SYSTEM_ID = 30_100_000;

/**
 * Systems seeded into the avoidance list by default. Zarzakh can't be routed
 * through normally, so it's avoided out of the box (but it's a removable entry,
 * not a hardcoded rule — and routing TO it still works).
 */
export const DEFAULT_AVOID_SYSTEMS = ["Zarzakh"];

/**
 * CCP asks third-party apps to send a descriptive User-Agent identifying the
 * app (and ideally a contact). Set ZIPPY_CONTACT in the environment to add one.
 */
export const USER_AGENT = process.env.ZIPPY_CONTACT
  ? `Zippy/0.1 (EVE route planner; ${process.env.ZIPPY_CONTACT})`
  : "Zippy/0.1 (EVE Online wormhole route planner)";

/** Thera and Turnur — the two public Eve-Scout mapped hubs. */
export const THERA_SYSTEM_ID = 31_000_005;
export const TURNUR_SYSTEM_ID = 30_002_086;

export const DEFAULT_AGE_THRESHOLD_HOURS = 16;
export const MIN_AGE_THRESHOLD_HOURS = 1;
export const MAX_AGE_THRESHOLD_HOURS = 48;

/** Minimum-wormhole-size dropdown, smallest → largest (matches Short Circuit). */
export const WORMHOLE_SIZE_OPTIONS: ReadonlyArray<{ value: WormholeSize; label: string }> = [
  { value: "small", label: "Small [all sizes]" },
  { value: "medium", label: "Medium and up" },
  { value: "large", label: "Large and up" },
  { value: "xlarge", label: "X-Large only" },
];

export type SecurityPresetKey = "shortest" | "prefer-safe" | "highsec-only" | "prefer-unsafe";

export const SECURITY_PRESETS: Record<
  SecurityPresetKey,
  { label: string; description: string; prio: Required<SecurityPrio> }
> = {
  shortest: {
    label: "Shortest",
    description: "Fewest jumps, ignoring security.",
    prio: { highsec: 1, lowsec: 1, nullsec: 1, wspace: 1 },
  },
  "prefer-safe": {
    label: "Prefer safer",
    description: "Bias toward highsec; take low/null only when it saves a lot.",
    prio: { highsec: 1, lowsec: 5, nullsec: 10, wspace: 3 },
  },
  "highsec-only": {
    label: "Safest",
    description: "Avoid low/null/wspace unless there is no other way.",
    prio: { highsec: 1, lowsec: 50, nullsec: 100, wspace: 50 },
  },
  "prefer-unsafe": {
    label: "Prefer low/null",
    description: "Bias away from highsec (e.g. avoiding gate camps on trade routes).",
    prio: { highsec: 20, lowsec: 1, nullsec: 1, wspace: 1 },
  },
};
