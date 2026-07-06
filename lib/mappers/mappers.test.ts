import { describe, expect, it } from "vitest";
import { parseEveScout, type EveScoutSignature } from "./evescout";
import { parseTripwire } from "./tripwire";
import { wormholeSizeFromCode } from "./statics";

const NOW = Date.parse("2026-07-06T00:00:00.000Z");

describe("wormholeSizeFromCode", () => {
  it("resolves known static codes", () => {
    expect(wormholeSizeFromCode("N110")).toBe("medium");
    expect(wormholeSizeFromCode("b274")).toBe("large"); // case-insensitive
    expect(wormholeSizeFromCode("A009")).toBe("small");
  });
  it("returns unknown for K162 and garbage", () => {
    expect(wormholeSizeFromCode("K162")).toBe("unknown");
    expect(wormholeSizeFromCode("nope")).toBe("unknown");
    expect(wormholeSizeFromCode(undefined)).toBe("unknown");
  });
});

describe("parseEveScout", () => {
  // Real records captured from api.eve-scout.com/v2/public/signatures.
  const data: EveScoutSignature[] = [
    {
      signature_type: "wormhole",
      wh_type: "J377",
      max_ship_size: "medium",
      remaining_hours: 5,
      out_system_id: 30002086,
      out_signature: "QYR-444",
      in_system_id: 31001155,
      in_signature: "CBR-256",
      updated_at: "2026-07-05T21:07:47.000Z",
    },
    {
      signature_type: "wormhole",
      wh_type: "N432",
      max_ship_size: "capital",
      remaining_hours: 2, // -> EOL
      out_system_id: 30002086,
      out_signature: "ZLG-348",
      in_system_id: 31002009,
      in_signature: "JEW-825",
      updated_at: "2026-07-05T23:44:29.000Z",
    },
    { signature_type: "combat", wh_type: null, max_ship_size: null, remaining_hours: null, out_system_id: 0, out_signature: null, in_system_id: 0, in_signature: null },
  ];

  const links = parseEveScout(data, NOW);

  it("skips non-wormhole signatures", () => {
    expect(links).toHaveLength(2);
  });
  it("maps Turnur <-> J-space with sizes and signatures", () => {
    const l = links[0];
    expect(l.a).toBe(30002086);
    expect(l.b).toBe(31001155);
    expect(l.info.size).toBe("medium");
    expect(l.info.signatureFrom).toBe("QYR-444");
    expect(l.info.signatureTo).toBe("CBR-256");
    expect(l.info.wormholeType).toBe("J377");
  });
  it("maps 'capital' to xlarge and flags low remaining hours as EOL", () => {
    expect(links[1].info.size).toBe("xlarge");
    expect(links[1].info.life).toBe("eol");
  });
});

describe("parseTripwire", () => {
  const chain = {
    signatures: {
      "1": { id: 1, signatureID: "abc-123", systemID: 30000142, modifiedTime: "2026-07-05T20:00:00Z" },
      "2": { id: 2, signatureID: "xyz-789", systemID: 31001234, modifiedTime: "2026-07-05T20:00:00Z" },
      "3": { id: 3, signatureID: "-------", systemID: 30002187 },
    },
    wormholes: {
      "10": { initialID: 1, secondaryID: 2, type: "N110", life: "critical", mass: "destab" },
      "11": { initialID: 1, secondaryID: 999 }, // dangling -> skipped
    },
  };

  const links = parseTripwire(chain, NOW);

  it("joins signatures into a single connection and drops dangling ones", () => {
    expect(links).toHaveLength(1);
  });
  it("derives size from the type code and maps life/mass", () => {
    const l = links[0];
    expect(l.a).toBe(30000142);
    expect(l.b).toBe(31001234);
    expect(l.info.size).toBe("medium"); // N110
    expect(l.info.life).toBe("eol"); // life "critical"
    expect(l.info.mass).toBe("destab");
    expect(l.info.signatureFrom).toBe("ABC-123");
  });
});
