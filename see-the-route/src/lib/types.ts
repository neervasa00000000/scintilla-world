/** Shared types for See-the-Route research instrument. */

export type CvdMode = "normal" | "protanopia" | "deuteranopia" | "tritanopia";
export type Severity = "high" | "medium" | "low";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ColourCluster {
  id: string;
  label: string;
  mean: Rgb;
  bbox: BBox;
  pixelCount: number;
  chroma: number;
}

export interface ConfusablePair {
  id: string;
  a: ColourCluster;
  b: ColourCluster;
  mode: Exclude<CvdMode, "normal">;
  deltaENormal: number;
  deltaESim: number;
  collapse: number; // 0–1, how much distance was lost
  severity: Severity;
  title: string;
  metric: string;
  suggestion: string;
}

export interface ProbePoint {
  x: number;
  y: number;
  rgb: Rgb;
  label: string;
}

export interface ProbeResult {
  a: ProbePoint;
  b: ProbePoint;
  byMode: Record<
    CvdMode,
    { deltaE: number; pass: boolean; rgbA: Rgb; rgbB: Rgb }
  >;
  threshold: number;
}

export interface LowVisionSettings {
  enabled: boolean;
  blurSigma: number; // 0–8
  contrast: number; // 0–1, 1 = full, 0 = washed
}

export interface AnalysisSettings {
  deltaEThreshold: number; // below this under CVD → fail (default 15)
  minNormalDeltaE: number; // pair must be distinguishable in normal first
  maxPairs: number;
  lowVision: LowVisionSettings;
}

export interface ImageDoc {
  id: "A" | "B";
  name: string;
  width: number;
  height: number;
  /** Original ImageData (may be downscaled for analysis). */
  imageData: ImageData;
  /** Display data URL of original (full or work-res). */
  url: string;
  /** Simulated panel data URLs. */
  sims: Record<CvdMode, string>;
  clusters: ColourCluster[];
  findings: ConfusablePair[];
  probe: ProbeResult | null;
  /** Optional sample pre-seeded probe pixel coords (image space). */
  seedProbe?: [{ x: number; y: number }, { x: number; y: number }];
}

export interface CompareSummary {
  sentence: string;
  aKept: number;
  bKept: number;
  totalCritical: number;
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  deltaEThreshold: 15,
  minNormalDeltaE: 20,
  maxPairs: 24,
  lowVision: {
    enabled: false,
    blurSigma: 1.5,
    contrast: 0.65,
  },
};

export const CVD_LABELS: Record<CvdMode, string> = {
  normal: "Normal",
  protanopia: "Protanopia",
  deuteranopia: "Deuteranopia",
  tritanopia: "Tritanopia",
};

export const CVD_MODES: CvdMode[] = [
  "normal",
  "protanopia",
  "deuteranopia",
  "tritanopia",
];
