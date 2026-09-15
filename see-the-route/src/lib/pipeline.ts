/**
 * Confusable-pair detector + probe evaluation.
 */

import { deltaE2000, colourNameHint, rgbHex } from "./color";
import { extractClusters, unionBBox } from "./analysis";
import { simulateRgb } from "./cvd";
import type {
  AnalysisSettings,
  ColourCluster,
  CompareSummary,
  ConfusablePair,
  CvdMode,
  ImageDoc,
  ProbePoint,
  ProbeResult,
  Severity,
} from "./types";

const CVD_FAIL_MODES: Exclude<CvdMode, "normal">[] = [
  "protanopia",
  "deuteranopia",
  "tritanopia",
];

function severityFromCollapse(
  deltaENormal: number,
  deltaESim: number,
  threshold: number
): Severity {
  const collapse = Math.max(0, 1 - deltaESim / Math.max(deltaENormal, 1e-6));
  if (deltaESim < threshold * 0.55 && collapse > 0.55) return "high";
  if (deltaESim < threshold && collapse > 0.35) return "medium";
  return "low";
}

function suggestionFor(mode: CvdMode, a: ColourCluster, b: ColourCluster): string {
  const pair = `${colourNameHint(a.mean)}/${colourNameHint(b.mean)}`;
  if (mode === "protanopia" || mode === "deuteranopia") {
    if (pair.includes("red") && pair.includes("green")) {
      return "Do not encode status by red vs green hue alone — add distinct icon shape, label, or stroke pattern.";
    }
    return "Add a non-hue cue (shape, label, dashed stroke, or luminance contrast ≥ ~3:1).";
  }
  return "Blue–yellow encoding may weaken — pair with texture, icon, or text label.";
}

export function findConfusablePairs(
  clusters: ColourCluster[],
  settings: AnalysisSettings
): ConfusablePair[] {
  const pairs: ConfusablePair[] = [];
  const { deltaEThreshold, minNormalDeltaE, maxPairs } = settings;

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i];
      const b = clusters[j];
      const dN = deltaE2000(a.mean, b.mean);
      if (dN < minNormalDeltaE) continue;

      for (const mode of CVD_FAIL_MODES) {
        const aS = simulateRgb(a.mean, mode);
        const bS = simulateRgb(b.mean, mode);
        const dS = deltaE2000(aS, bS);
        // Flag only if distinguishable in normal but collapses under CVD
        if (dS >= deltaEThreshold) continue;
        if (dS >= dN * 0.7 && dS >= deltaEThreshold * 0.9) continue;

        const collapse = Math.max(0, 1 - dS / dN);
        if (collapse < 0.25 && dS >= deltaEThreshold * 0.85) continue;

        const sev = severityFromCollapse(dN, dS, deltaEThreshold);
        pairs.push({
          id: `${a.id}-${b.id}-${mode}`,
          a,
          b,
          mode,
          deltaENormal: dN,
          deltaESim: dS,
          collapse,
          severity: sev,
          title: `${a.label} (${rgbHex(a.mean)}) vs ${b.label} (${rgbHex(b.mean)})`,
          metric: `ΔE ${dN.toFixed(0)} → ${dS.toFixed(0)} under ${mode} (threshold ${deltaEThreshold})`,
          suggestion: suggestionFor(mode, a, b),
        });
      }
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  pairs.sort((x, y) => {
    const sr = rank[x.severity] - rank[y.severity];
    if (sr !== 0) return sr;
    return y.collapse - x.collapse;
  });

  // Deduplicate: keep worst mode per cluster-pair
  const seen = new Set<string>();
  const deduped: ConfusablePair[] = [];
  for (const p of pairs) {
    const key = [p.a.id, p.b.id].sort().join("|");
    // Allow multiple modes if all high — but cap per pair to 1 unless different severity story
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
    if (deduped.length >= maxPairs) break;
  }
  return deduped;
}

export function evaluateProbe(
  a: ProbePoint,
  b: ProbePoint,
  threshold: number
): ProbeResult {
  const modes: CvdMode[] = [
    "normal",
    "protanopia",
    "deuteranopia",
    "tritanopia",
  ];
  const byMode = {} as ProbeResult["byMode"];
  for (const mode of modes) {
    const rgbA = simulateRgb(a.rgb, mode);
    const rgbB = simulateRgb(b.rgb, mode);
    const d = deltaE2000(rgbA, rgbB);
    byMode[mode] = {
      deltaE: d,
      pass: d >= threshold,
      rgbA,
      rgbB,
    };
  }
  return { a, b, byMode, threshold };
}

export function analyzeImageData(
  imageData: ImageData,
  settings: AnalysisSettings
): { clusters: ColourCluster[]; findings: ConfusablePair[] } {
  const clusters = extractClusters(imageData);
  const findings = findConfusablePairs(clusters, settings);
  return { clusters, findings };
}

/** Critical = high severity findings under protanopia or deuteranopia. */
export function criticalCount(findings: ConfusablePair[]): number {
  return findings.filter(
    (f) =>
      f.severity === "high" &&
      (f.mode === "protanopia" || f.mode === "deuteranopia")
  ).length;
}

export function compareDocs(a: ImageDoc, b: ImageDoc): CompareSummary {
  const modes: Exclude<CvdMode, "normal">[] = [
    "protanopia",
    "deuteranopia",
    "tritanopia",
  ];

  // Score: count of pairs that remain distinguishable (ΔE ≥ threshold) among
  // pairs that were distinguishable in normal — approximate via findings invert
  const score = (doc: ImageDoc) => {
    let fails = 0;
    let criticalFails = 0;
    for (const f of doc.findings) {
      fails++;
      if (f.severity === "high") criticalFails++;
    }
    // Also use probe if present
    let probeKept = 0;
    let probeTotal = 0;
    if (doc.probe) {
      for (const m of modes) {
        probeTotal++;
        if (doc.probe.byMode[m].pass) probeKept++;
      }
    }
    return { fails, criticalFails, probeKept, probeTotal };
  };

  const sa = score(a);
  const sb = score(b);

  // Prefer probe-based critical pair keep rate when both have probes
  if (sa.probeTotal > 0 && sb.probeTotal > 0) {
    const total = sa.probeTotal;
    const sentence =
      sb.probeKept === sa.probeKept
        ? `A and B both keep ${sa.probeKept}/${total} probe pairs distinguishable under CVD.`
        : sb.probeKept > sa.probeKept
          ? `B keeps ${sb.probeKept}/${total} critical probe pairs distinguishable under CVD; A keeps ${sa.probeKept}/${total}.`
          : `A keeps ${sa.probeKept}/${total} critical probe pairs distinguishable under CVD; B keeps ${sb.probeKept}/${total}.`;
    return {
      sentence,
      aKept: sa.probeKept,
      bKept: sb.probeKept,
      totalCritical: total,
    };
  }

  // Fall back to auto finding counts (fewer high fails = better)
  const aOk = Math.max(0, 3 - Math.min(3, sa.criticalFails));
  const bOk = Math.max(0, 3 - Math.min(3, sb.criticalFails));
  const sentence =
    bOk === aOk
      ? `A and B show similar CVD risk (${sa.criticalFails} vs ${sb.criticalFails} high confusable pairs).`
      : bOk > aOk
        ? `B keeps ${bOk}/3 critical pairs clearer under CVD; A keeps ${aOk}/3 (${sb.criticalFails} vs ${sa.criticalFails} high collapses).`
        : `A keeps ${aOk}/3 critical pairs clearer under CVD; B keeps ${bOk}/3 (${sa.criticalFails} vs ${sb.criticalFails} high collapses).`;

  return {
    sentence,
    aKept: aOk,
    bKept: bOk,
    totalCritical: 3,
  };
}

export { unionBBox };
