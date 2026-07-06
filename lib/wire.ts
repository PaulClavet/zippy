/**
 * Client-facing wire types (safe to import into client components — no server
 * or Node-only code). These mirror what the API routes return.
 */

export interface SystemHit {
  id: number;
  name: string;
  security: number;
  band: "highsec" | "lowsec" | "nullsec" | "wspace";
  regionName?: string;
}

export interface RouteStepDTO {
  index: number;
  systemId: number;
  systemName: string;
  security: number;
  regionName?: string;
  connectionType?: "gate" | "wormhole";
  signature?: string;
  returnSignature?: string;
  wormholeType?: string;
  instruction: string;
}

export interface PlanSuccessDTO {
  ok: true;
  summary: { jumps: number; gateJumps: number; wormholeJumps: number };
  steps: RouteStepDTO[];
  fleet: string;
  waypoints: number[];
}

export interface PlanFailureDTO {
  ok: false;
  code: string;
  error: string;
}

export type PlanResponseDTO = PlanSuccessDTO | PlanFailureDTO;

export interface WormholeLinkDTO {
  a: number;
  b: number;
  info: {
    size: string;
    mass: string;
    life: string;
    signatureFrom?: string;
    signatureTo?: string;
    wormholeType?: string;
    ageHours?: number;
  };
}

export interface MapperResultDTO {
  source: "eve-scout" | "tripwire";
  fetchedAt: string;
  count: number;
  links: WormholeLinkDTO[];
  error?: string;
  message?: string;
}

export interface MetaDTO {
  sso: boolean;
  sde: { generatedAt: string; isDemo: boolean; systems: number };
}

export interface CharacterDTO {
  id: number;
  name: string;
}
