/**
 * Heuristic failure / risk detection for map & route UI screenshots.
 * Transparent research-demo flags — not a WCAG audit.
 */

import {
  processImageData,
  type SimulationKind,
} from "./cvd";

export type Severity = "High" | "Medium" | "Low";

export interface FailureFlag {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  related: SimulationKind[];
}

export interface FailureReport {
  flags: FailureFlag[];
  counts: { high: number; medium: number; low: number };
  metrics: {
    contrastDrop: Record<string, number>;
    rgCollapseProtan: number;
    rgCollapseDeutan: number;
    chipConfusion: number;
  };
}

function luminance(r: number, g: number, b: number): number {
  const toLin = (c: number) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

function relativeContrast(l1: number, l2: number): number {
  const a = Math.max(l1, l2);
  const b = Math.min(l1, l2);
  return (a + 0.05) / (b + 0.05);
}

/** Mean local edge contrast (Sobel-ish on luminance). */
function meanLocalContrast(data: ImageData): number {
  const { width, height, data: px } = data;
  let sum = 0;
  let n = 0;
  const lumAt = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return luminance(px[i], px[i + 1], px[i + 2]);
  };
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const gx = lumAt(x + 1, y) - lumAt(x - 1, y);
      const gy = lumAt(x, y + 1) - lumAt(x, y - 1);
      sum += Math.sqrt(gx * gx + gy * gy);
      n++;
    }
  }
  return n ? sum / n : 0;
}

function rgbDist(
  a: [number, number, number],
  b: [number, number, number]
): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function isSaturatedRed(r: number, g: number, b: number): boolean {
  return r > 140 && r - g > 40 && r - b > 30;
}

function isSaturatedGreen(r: number, g: number, b: number): boolean {
  return g > 120 && g - r > 25 && g >= b - 10;
}

function samplePixels(data: ImageData, step = 4) {
  const reds: [number, number, number][] = [];
  const greens: [number, number, number][] = [];
  const chips: [number, number, number][] = [];
  const { width, height, data: px } = data;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;

      if (isSaturatedRed(r, g, b)) reds.push([r, g, b]);
      if (isSaturatedGreen(r, g, b)) greens.push([r, g, b]);
      if (sat > 0.45 && max > 80 && max < 250) chips.push([r, g, b]);
    }
  }
  return { reds, greens, chips };
}

function meanPairDistance(
  a: [number, number, number][],
  b: [number, number, number][],
  limit = 80
): number {
  if (!a.length || !b.length) return 0;
  const aa = a.slice(0, limit);
  const bb = b.slice(0, limit);
  let sum = 0;
  let n = 0;
  for (let i = 0; i < aa.length; i++) {
    for (let j = 0; j < Math.min(3, bb.length); j++) {
      sum += rgbDist(aa[i], bb[(i + j) % bb.length]);
      n++;
    }
  }
  return n ? sum / n : 0;
}

function chipConfusionScore(
  chips: [number, number, number][],
  simKind: "protanopia" | "deuteranopia"
): number {
  if (chips.length < 8) return 0;
  // Cluster by crude hue buckets, measure how many distinct buckets collapse
  const buckets = new Map<string, [number, number, number]>();
  for (const c of chips.slice(0, 400)) {
    const key = `${Math.round(c[0] / 32)}_${Math.round(c[1] / 32)}_${Math.round(c[2] / 32)}`;
    if (!buckets.has(key)) buckets.set(key, c);
  }
  const originals = [...buckets.values()];
  if (originals.length < 3) return 0;

  const simulated = originals.map((c) => {
    const tmp = new ImageData(1, 1);
    tmp.data[0] = c[0];
    tmp.data[1] = c[1];
    tmp.data[2] = c[2];
    tmp.data[3] = 255;
    const out = processImageData(tmp, simKind);
    return [out.data[0], out.data[1], out.data[2]] as [number, number, number];
  });

  let closePairs = 0;
  let pairs = 0;
  for (let i = 0; i < simulated.length; i++) {
    for (let j = i + 1; j < simulated.length; j++) {
      const before = rgbDist(originals[i], originals[j]);
      const after = rgbDist(simulated[i], simulated[j]);
      if (before > 55) {
        pairs++;
        if (after < before * 0.35 || after < 28) closePairs++;
      }
    }
  }
  return pairs ? closePairs / pairs : 0;
}

export function analyzeFailures(source: ImageData): FailureReport {
  const flags: FailureFlag[] = [];
  const { reds, greens, chips } = samplePixels(source);

  const normalContrast = meanLocalContrast(source);
  const sims: Array<"protanopia" | "deuteranopia" | "tritanopia" | "lowVision"> =
    ["protanopia", "deuteranopia", "tritanopia", "lowVision"];

  const contrastDrop: Record<string, number> = {};
  for (const kind of sims) {
    const sim = processImageData(source, kind);
    const c = meanLocalContrast(sim);
    const drop =
      normalContrast > 1e-6
        ? Math.max(0, (normalContrast - c) / normalContrast)
        : 0;
    contrastDrop[kind] = drop;
  }

  const baseRG = meanPairDistance(reds, greens);

  // Transform sampled red/green through CVD matrices to measure collapse.
  const transformSamples = (
    samples: [number, number, number][],
    kind: "protanopia" | "deuteranopia"
  ) =>
    samples.slice(0, 60).map((c) => {
      const tmp = new ImageData(1, 1);
      tmp.data.set([c[0], c[1], c[2], 255]);
      const o = processImageData(tmp, kind);
      return [o.data[0], o.data[1], o.data[2]] as [number, number, number];
    });

  const protRG = meanPairDistance(
    transformSamples(reds, "protanopia"),
    transformSamples(greens, "protanopia")
  );
  const deutRG = meanPairDistance(
    transformSamples(reds, "deuteranopia"),
    transformSamples(greens, "deuteranopia")
  );

  const rgCollapseProtan =
    baseRG > 20 ? Math.max(0, 1 - protRG / baseRG) : 0;
  const rgCollapseDeutan =
    baseRG > 20 ? Math.max(0, 1 - deutRG / baseRG) : 0;

  const chipConfusion = Math.max(
    chipConfusionScore(chips, "protanopia"),
    chipConfusionScore(chips, "deuteranopia")
  );

  // --- Flag generation ---
  if (rgCollapseProtan > 0.55 && reds.length > 10 && greens.length > 10) {
    flags.push({
      id: "rg-protan",
      severity: rgCollapseProtan > 0.72 ? "High" : "Medium",
      title: "Red–green route colours collapse under protanopia",
      detail: `Saturated red/green separation dropped ~${Math.round(rgCollapseProtan * 100)}% in Machado protanopia simulation. Traffic / line colours may become indistinguishable.`,
      related: ["protanopia"],
    });
  }

  if (rgCollapseDeutan > 0.55 && reds.length > 10 && greens.length > 10) {
    flags.push({
      id: "rg-deutan",
      severity: rgCollapseDeutan > 0.72 ? "High" : "Medium",
      title: "Red–green route colours collapse under deuteranopia",
      detail: `Saturated red/green separation dropped ~${Math.round(rgCollapseDeutan * 100)}% under deuteranopia. Relying on hue alone for routes is high risk.`,
      related: ["deuteranopia"],
    });
  }

  if (chipConfusion > 0.28) {
    flags.push({
      id: "legend-chips",
      severity: chipConfusion > 0.45 ? "High" : "Medium",
      title: "Legend-like colour chips become hard to tell apart",
      detail: `~${Math.round(chipConfusion * 100)}% of previously distinct saturated colour pairs converge under CVD. Check legends, pins, and polyline keys.`,
      related: ["protanopia", "deuteranopia"],
    });
  }

  if (contrastDrop.lowVision > 0.35) {
    flags.push({
      id: "lv-contrast",
      severity: contrastDrop.lowVision > 0.5 ? "High" : "Medium",
      title: "Local contrast collapses under low-vision filter",
      detail: `Mean edge contrast fell ~${Math.round(contrastDrop.lowVision * 100)}% after mild blur + contrast compression. Fine map labels and thin polylines are at risk.`,
      related: ["lowVision"],
    });
  }

  if (contrastDrop.protanopia > 0.18 || contrastDrop.deuteranopia > 0.18) {
    const worst =
      contrastDrop.protanopia >= contrastDrop.deuteranopia
        ? "protanopia"
        : "deuteranopia";
    flags.push({
      id: "cvd-contrast",
      severity: "Low",
      title: `Overall contrast score drops under ${worst}`,
      detail: `Structural contrast decreased ~${Math.round(contrastDrop[worst] * 100)}% versus Normal. Secondary cue: verify stroke weight and non-colour encodings.`,
      related: [worst],
    });
  }

  if (contrastDrop.tritanopia > 0.22) {
    flags.push({
      id: "tritan-drop",
      severity: "Low",
      title: "Blue–yellow encoding may weaken under tritanopia",
      detail: `Contrast under tritanopia dropped ~${Math.round(contrastDrop.tritanopia * 100)}%. Water / sky / transit-blue layers deserve a second look.`,
      related: ["tritanopia"],
    });
  }

  // Adjacent red/green low-contrast regions in original
  let riskyRG = 0;
  let checked = 0;
  const { width, height, data: px } = source;
  for (let y = 2; y < height - 2; y += 6) {
    for (let x = 2; x < width - 2; x += 6) {
      const i = (y * width + x) * 4;
      const j = (y * width + x + 2) * 4;
      const a: [number, number, number] = [px[i], px[i + 1], px[i + 2]];
      const b: [number, number, number] = [px[j], px[j + 1], px[j + 2]];
      const redGreenPair =
        (isSaturatedRed(...a) && isSaturatedGreen(...b)) ||
        (isSaturatedGreen(...a) && isSaturatedRed(...b));
      if (!redGreenPair) continue;
      checked++;
      const c = relativeContrast(
        luminance(...a),
        luminance(...b)
      );
      if (c < 1.6) riskyRG++;
    }
  }
  if (checked > 5 && riskyRG / checked > 0.4) {
    flags.push({
      id: "rg-luminance",
      severity: "High",
      title: "Colour-only red/green regions share similar luminance",
      detail: `${Math.round((riskyRG / checked) * 100)}% of sampled adjacent red–green pairs sit below ~1.6:1 luminance contrast. Under CVD they likely merge.`,
      related: ["protanopia", "deuteranopia"],
    });
  }

  if (flags.length === 0) {
    flags.push({
      id: "clean",
      severity: "Low",
      title: "No strong colour-only collapse detected",
      detail:
        "Heuristics did not find severe red–green collapse or legend confusion on this screenshot. Still verify labels, focus states, and non-colour cues manually.",
      related: ["normal"],
    });
  }

  // Sort High → Medium → Low
  const rank = { High: 0, Medium: 1, Low: 2 };
  flags.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const counts = {
    high: flags.filter((f) => f.severity === "High").length,
    medium: flags.filter((f) => f.severity === "Medium").length,
    low: flags.filter((f) => f.severity === "Low").length,
  };

  return {
    flags,
    counts,
    metrics: {
      contrastDrop,
      rgCollapseProtan,
      rgCollapseDeutan,
      chipConfusion,
    },
  };
}
