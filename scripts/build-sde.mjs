#!/usr/bin/env node
/**
 * Build Zippy's compact star-map from the EVE Static Data Export.
 *
 * Downloads the current Fuzzwork CSV dumps (systems, gate jumps, regions,
 * constellations), then emits a single compact JSON at
 * lib/sde/data/starmap.json that the app loads at runtime.
 *
 * Usage:  node scripts/build-sde.mjs   (or: pnpm sde:build)
 */
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, ".sde-cache");
const OUT_FILE = path.join(ROOT, "lib", "sde", "data", "starmap.json");

const BASE = "https://www.fuzzwork.co.uk/dump/latest/csv";
const FILES = {
  systems: "mapSolarSystems.csv",
  jumps: "mapSolarSystemJumps.csv",
  regions: "mapRegions.csv",
  constellations: "mapConstellations.csv",
};

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function download(name) {
  const dest = path.join(CACHE_DIR, name);
  if (await exists(dest)) {
    console.log(`  cached  ${name}`);
    return dest;
  }
  const url = `${BASE}/${name}`;
  console.log(`  fetch   ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Failed to download ${url}: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return dest;
}

/** Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, CRLF). */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // ignore; handled by \n
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function indexHeaders(header) {
  const idx = {};
  header.forEach((name, i) => {
    idx[name.trim()] = i;
  });
  return idx;
}

async function loadCsv(name) {
  const file = path.join(CACHE_DIR, name);
  const text = await readFile(file, "utf8");
  const rows = parseCsv(text);
  const header = rows.shift();
  return { header: indexHeaders(header), rows };
}

function roundSecurity(raw) {
  // Keep 4 decimals — enough to preserve the 0.45 highsec boundary.
  return Math.round(Number(raw) * 10000) / 10000;
}

async function main() {
  console.log("Zippy SDE builder");
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(path.dirname(OUT_FILE), { recursive: true });

  console.log("Downloading SDE tables…");
  for (const name of Object.values(FILES)) await download(name);

  console.log("Parsing…");
  const regionsCsv = await loadCsv(FILES.regions);
  const constsCsv = await loadCsv(FILES.constellations);
  const systemsCsv = await loadCsv(FILES.systems);
  const jumpsCsv = await loadCsv(FILES.jumps);

  // regions: [regionId, name]
  const rH = regionsCsv.header;
  const regions = regionsCsv.rows
    .filter((r) => r.length > 1)
    .map((r) => [Number(r[rH.regionID]), r[rH.regionName]]);

  // systems: [id, name, security, regionId, constellationId]
  const sH = systemsCsv.header;
  const systems = systemsCsv.rows
    .filter((r) => r.length > sH.security)
    .map((r) => [
      Number(r[sH.solarSystemID]),
      r[sH.solarSystemName],
      roundSecurity(r[sH.security]),
      Number(r[sH.regionID]),
      Number(r[sH.constellationID]),
    ]);

  // jumps: dedupe directed rows into undirected [min, max] pairs.
  const jH = jumpsCsv.header;
  const seen = new Set();
  const jumps = [];
  for (const r of jumpsCsv.rows) {
    if (r.length <= jH.toSolarSystemID) continue;
    const a = Number(r[jH.fromSolarSystemID]);
    const b = Number(r[jH.toSolarSystemID]);
    if (!a || !b) continue;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const key = `${lo}-${hi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    jumps.push([lo, hi]);
  }

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: BASE,
    counts: { systems: systems.length, regions: regions.length, jumps: jumps.length },
    regions,
    systems,
    jumps,
  };

  await writeFile(OUT_FILE, JSON.stringify(out));
  const { size } = await stat(OUT_FILE);
  console.log(
    `Wrote ${OUT_FILE}\n  ${systems.length} systems, ${regions.length} regions, ${jumps.length} gate connections (${(size / 1024 / 1024).toFixed(2)} MB)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
