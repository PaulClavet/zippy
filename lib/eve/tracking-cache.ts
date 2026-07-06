/**
 * In-memory movement cache for chain awareness. Tripwire shares no online
 * status (it's client-only), and a logged-off pilot who leaves Tripwire open
 * lingers in tracking at their logout spot. We can't know "offline", but we can
 * observe movement: a pilot who hasn't changed system for a while is idle
 * (logged off, or genuinely parked). Keyed by character name (globally unique).
 *
 * This is a best-effort proxy, shared across viewers and warmed by whoever is
 * polling; it resets on server restart.
 */
interface MoveRecord {
  systemId: number;
  lastMovedAt: number;
  lastSeenAt: number;
}

const cache = new Map<string, MoveRecord>();
const EVICT_MS = 60 * 60 * 1000; // forget pilots unseen for an hour

/**
 * Record each pilot's current system and return minutes-since-last-move per
 * pilot. A pilot new to the cache (or who just moved) reports 0.
 */
export function recordAndIdle(
  pilots: Array<{ name: string; systemId: number }>,
  now: number,
): Map<string, number> {
  const idle = new Map<string, number>();
  for (const p of pilots) {
    const prev = cache.get(p.name);
    const lastMovedAt = prev && prev.systemId === p.systemId ? prev.lastMovedAt : now;
    cache.set(p.name, { systemId: p.systemId, lastMovedAt, lastSeenAt: now });
    idle.set(p.name, Math.floor((now - lastMovedAt) / 60000));
  }
  for (const [name, rec] of cache) {
    if (now - rec.lastSeenAt > EVICT_MS) cache.delete(name);
  }
  return idle;
}
