import fs from "node:fs";
import path from "node:path";
import { buildStarMap } from "../graph/build";
import type { SolarSystem, StarMap } from "../graph/types";
import { SAMPLE_SDE } from "./sample";

/** Compact on-disk star-map shape emitted by scripts/build-sde.mjs. */
export interface SdeData {
  generatedAt: string;
  source?: string;
  counts?: { systems: number; regions: number; jumps: number };
  /** [regionId, regionName] */
  regions: Array<[number, string]>;
  /** [systemId, name, security, regionId, constellationId] */
  systems: Array<[number, string, number, number, number]>;
  /** undirected gate pairs [a, b] */
  jumps: Array<[number, number]>;
  /** true when this is the built-in demo fallback (SDE not built yet). */
  isDemo?: boolean;
}

const DATA_PATH = path.join(process.cwd(), "lib", "sde", "data", "starmap.json");

let cachedData: SdeData | null = null;
let cachedMap: StarMap | null = null;

/** Load the raw SDE data (generated file if present, else the demo fallback). */
export function loadSde(): SdeData {
  if (cachedData) return cachedData;
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    cachedData = JSON.parse(raw) as SdeData;
  } catch {
    cachedData = { ...SAMPLE_SDE, isDemo: true };
  }
  return cachedData;
}

export function isDemoData(): boolean {
  return loadSde().isDemo === true;
}

export function sdeMeta(): { generatedAt: string; isDemo: boolean; systems: number } {
  const data = loadSde();
  return {
    generatedAt: data.generatedAt,
    isDemo: data.isDemo === true,
    systems: data.systems.length,
  };
}

/**
 * The base (gate-only) star map, built once and cached. Live wormhole data is
 * layered on top of a clone of this (see cloneStarMap) so the shared base is
 * never mutated.
 */
export function loadBaseStarMap(): StarMap {
  if (cachedMap) return cachedMap;
  const data = loadSde();
  const regionNames = new Map<number, string>(data.regions.map(([id, name]) => [id, name]));
  const systems: SolarSystem[] = data.systems.map(([id, name, security, regionId, constellationId]) => ({
    id,
    name,
    security,
    regionId,
    regionName: regionNames.get(regionId),
    constellationId,
  }));
  cachedMap = buildStarMap(systems, data.jumps);
  return cachedMap;
}
