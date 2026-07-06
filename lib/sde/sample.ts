import type { SdeData } from "./loader";

/**
 * Tiny illustrative fallback map used only when the full SDE hasn't been built
 * yet (run `pnpm sde:build`). Real system names/ids around the Caldari trade
 * hub; connectivity is approximate and for demo purposes only.
 */
export const SAMPLE_SDE: SdeData = {
  generatedAt: "demo",
  isDemo: true,
  regions: [
    [10000002, "The Forge"],
    [10000030, "Heimatar"],
  ],
  // [id, name, security, regionId, constellationId]
  systems: [
    [30000142, "Jita", 0.9459, 10000002, 20000020],
    [30000144, "Perimeter", 1.0, 10000002, 20000020],
    [30000145, "New Caldari", 1.0, 10000002, 20000020],
    [30000138, "Urlen", 0.9, 10000002, 20000020],
    [30000140, "Sobaseki", 0.5, 10000002, 20000020],
    [30002811, "Nourvukaiken", 0.7, 10000002, 20000411],
    [30002813, "Tama", 0.3, 10000002, 20000411],
    [30002815, "Kedama", 0.2, 10000002, 20000411],
    [30002537, "Amamake", 0.4, 10000030, 20000306],
  ],
  // undirected gate pairs
  jumps: [
    [30000142, 30000144],
    [30000142, 30000145],
    [30000142, 30000138],
    [30000138, 30000140],
    [30000140, 30002811],
    [30002811, 30002813],
    [30002813, 30002815],
    [30002815, 30002537],
  ],
};
