#!/usr/bin/env node
/**
 * Build a per-type wormhole reference from the EVE SDE dogma attributes, so we
 * can compute wormhole life by TYPE (they range 4.5h–48h, not a flat value).
 * Writes lib/mappers/wormholes.json: code -> { lifeHours, totalMass, jumpMass }.
 *
 * Usage: node scripts/build-wormholes.mjs
 */
import { createWriteStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, ".sde-cache");
const OUT = path.join(ROOT, "lib", "mappers", "wormholes.json");
const BASE = "https://www.fuzzwork.co.uk/dump/latest/csv";
const WORMHOLE_GROUP_ID = "988";

// dgma attribute ids (from dgmAttributeTypes: wormhole* attributes)
const ATTR = { life: "1382", totalMass: "1383", jumpMass: "1385" };

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}
async function download(name) {
  const dest = path.join(CACHE, name);
  if (await exists(dest)) return dest;
  console.log(`  fetch ${name}`);
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok || !res.body) throw new Error(`download ${name}: ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return dest;
}
async function lines(name) {
  let text = await readFile(path.join(CACHE, name), "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.split(/\r?\n/).filter(Boolean);
}
// Quote-strip then comma-split. Safe for the leading columns we read (the only
// fields with embedded commas are trailing descriptions we ignore).
const cells = (line) => line.replace(/"/g, "").split(",");

async function main() {
  await mkdir(CACHE, { recursive: true });
  console.log("Downloading SDE tables…");
  for (const f of ["invTypes.csv", "dgmTypeAttributes.csv"]) await download(f);

  // wormhole types (group 988): typeID -> code (names are "Wormhole XNNN")
  const codeByType = new Map();
  const invLines = await lines("invTypes.csv");
  invLines.shift();
  for (const l of invLines) {
    const c = cells(l);
    if (c[1] !== WORMHOLE_GROUP_ID) continue;
    const name = (c[2] || "").trim();
    const code = name.replace(/^Wormhole\s+/i, "").toUpperCase();
    if (/^[A-Z]\d{3}$/.test(code)) codeByType.set(c[0], code);
  }
  console.log(`wormhole types: ${codeByType.size}`);

  // dgmTypeAttributes: typeID, attributeID, valueInt, valueFloat
  const perType = new Map();
  const dtaLines = await lines("dgmTypeAttributes.csv");
  dtaLines.shift();
  for (const l of dtaLines) {
    const c = cells(l);
    if (!codeByType.has(c[0])) continue;
    const val = c[3] !== "" && c[3] != null ? Number(c[3]) : Number(c[2]);
    const rec = perType.get(c[0]) ?? {};
    if (c[1] === ATTR.life) rec.lifeMin = val;
    else if (c[1] === ATTR.totalMass) rec.totalMass = val;
    else if (c[1] === ATTR.jumpMass) rec.jumpMass = val;
    perType.set(c[0], rec);
  }

  const out = {};
  const dist = new Map();
  for (const [typeID, code] of codeByType) {
    const rec = perType.get(typeID) ?? {};
    const lifeHours = rec.lifeMin != null ? Math.round((rec.lifeMin / 60) * 10) / 10 : null;
    out[code] = { lifeHours, totalMass: rec.totalMass ?? null, jumpMass: rec.jumpMass ?? null };
    const k = lifeHours == null ? "unknown" : `${lifeHours}h`;
    dist.set(k, (dist.get(k) ?? 0) + 1);
  }

  console.log("\nlifetime distribution:");
  for (const [k, n] of [...dist.entries()].sort()) console.log(`  ${k}: ${n} types`);
  console.log("\nexamples:");
  for (const code of ["K162", "N110", "C247", "B274", "Z971", "R943", "N432"]) {
    if (out[code]) console.log(`  ${code}: ${out[code].lifeHours}h`);
  }

  const sorted = {};
  for (const code of Object.keys(out).sort()) sorted[code] = out[code];
  await writeFile(OUT, JSON.stringify(sorted));
  console.log(`\nwrote ${OUT} (${Object.keys(sorted).length} types)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
