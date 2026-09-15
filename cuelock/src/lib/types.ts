/** CueLock domain types — semantic navigation cues. */

export type CueRole =
  | "route_active"
  | "route_alt"
  | "hazard"
  | "mode_walk"
  | "mode_transit"
  | "destination"
  | "legend_chip"
  | "custom";

export type PatternEncoding = "solid" | "dashed" | "dotted" | "hatch";

export type SecondaryEncoding = {
  pattern?: PatternEncoding;
  width?: number;
  icon?: string;
  labelOnMap?: boolean;
};

export type Cue = {
  id: string;
  role: CueRole;
  label: string;
  colour: string;
  secondaryEncoding: SecondaryEncoding;
  geometryRef?: string;
  critical?: boolean;
};

export type CvdMode = "normal" | "protanopia" | "deuteranopia" | "tritanopia";

export type PairVerdict = {
  aId: string;
  bId: string;
  aLabel: string;
  bLabel: string;
  aRole: CueRole;
  bRole: CueRole;
  mode: Exclude<CvdMode, "normal">;
  deltaENormal: number;
  deltaECvd: number;
  threshold: number;
  colourFail: boolean;
  dualEncodingFail: boolean;
  secondaryDiffer: boolean;
  status: "PASS" | "FAIL";
  reason: string;
};

export type VerifyReport = {
  version: "1.0";
  tool: "CueLock";
  generatedAt: string;
  model: "Machado et al. 2009";
  deltaE: "CIEDE2000";
  threshold: number;
  cues: Cue[];
  pairs: PairVerdict[];
  summary: {
    pass: boolean;
    failCount: number;
    passCount: number;
    colourOnlyFails: number;
    deltaEFails: number;
  };
};

export type VerifyOptions = {
  threshold?: number;
  criticalRoles?: CueRole[];
};

export const ROLE_LABELS: Record<CueRole, string> = {
  route_active: "Active route",
  route_alt: "Alternate route",
  hazard: "Hazard",
  mode_walk: "Walk mode",
  mode_transit: "Transit mode",
  destination: "Destination",
  legend_chip: "Legend chip",
  custom: "Custom",
};

export const DEFAULT_CRITICAL: CueRole[] = [
  "route_active",
  "route_alt",
  "hazard",
  "destination",
];

export const CVD_MODES: Exclude<CvdMode, "normal">[] = [
  "protanopia",
  "deuteranopia",
  "tritanopia",
];
