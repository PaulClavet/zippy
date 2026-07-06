import type { SolarSystem, StarMap, SystemId } from "../graph/types";

export function findSystemByExactName(map: StarMap, name: string): SolarSystem | undefined {
  const lower = name.trim().toLowerCase();
  for (const s of map.systems.values()) {
    if (s.name.toLowerCase() === lower) return s;
  }
  return undefined;
}

/** Resolve a system reference (numeric id, id-as-string, or exact name) to an id. */
export function resolveSystem(map: StarMap, ref: string | number): SystemId | null {
  if (typeof ref === "number") return map.systems.has(ref) ? ref : null;
  const trimmed = ref.trim();
  const asNum = Number(trimmed);
  if (trimmed !== "" && Number.isInteger(asNum) && map.systems.has(asNum)) return asNum;
  const found = findSystemByExactName(map, trimmed);
  return found ? found.id : null;
}

/**
 * Case-insensitive system search for autocomplete. Exact match first, then
 * prefix matches, then substring matches; each group sorted alphabetically.
 */
export function searchSystems(map: StarMap, query: string, limit = 15): SolarSystem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  let exact: SolarSystem | undefined;
  const prefix: SolarSystem[] = [];
  const substr: SolarSystem[] = [];

  for (const s of map.systems.values()) {
    const name = s.name.toLowerCase();
    if (name === q) exact = s;
    else if (name.startsWith(q)) prefix.push(s);
    else if (name.includes(q)) substr.push(s);
  }

  const byName = (a: SolarSystem, b: SolarSystem) => a.name.localeCompare(b.name);
  prefix.sort(byName);
  substr.sort(byName);

  const ordered = exact ? [exact, ...prefix, ...substr] : [...prefix, ...substr];
  return ordered.slice(0, limit);
}
