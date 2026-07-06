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

export interface WormholeDetailsDTO {
  signature?: string;
  returnSignature?: string;
  type?: string;
  size: string;
  mass: string;
  life: string;
  ageHours?: number;
  estimatedHoursLeft?: number;
  maxLifeHours?: number;
  maxHoursLeft?: number;
}

export interface RouteStepDTO {
  index: number;
  systemId: number;
  systemName: string;
  security: number;
  regionName?: string;
  action?: string;
  via?: "gate" | "wormhole";
  wormhole?: WormholeDetailsDTO;
  isDestination: boolean;
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

export interface TrackedPilotDTO {
  name: string;
  ship: string;
  systemId: number;
  systemName: string;
  jumps: number;
  /** Minutes since this pilot last changed system (movement-based idle proxy). */
  idleMinutes: number;
}

export interface TrackingResponseDTO {
  focusSystemId: number;
  focusName: string;
  pilots: TrackedPilotDTO[];
  count: number;
  truncated: boolean;
  generatedAt: string;
}
