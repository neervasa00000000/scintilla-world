/**
 * CueLock verification engine.
 * Dual-encoding gate: if ΔE under CVD < threshold AND secondary encodings identical → FAIL.
 */

import { deltaE2000, parseHex } from "./color";
import { simulateRgb } from "./cvd";
import {
  CVD_MODES,
  DEFAULT_CRITICAL,
  type Cue,
  type CueRole,
  type PairVerdict,
  type SecondaryEncoding,
  type VerifyOptions,
  type VerifyReport,
} from "./types";

export function secondarySignature(s: SecondaryEncoding): string {
  return [
    s.pattern ?? "solid",
    String(s.width ?? 0),
    s.icon ?? "",
    s.labelOnMap ? "1" : "0",
  ].join("|");
}

export function secondaryEncodingsDiffer(a: Cue, b: Cue): boolean {
  return secondarySignature(a.secondaryEncoding) !== secondarySignature(b.secondaryEncoding);
}

function isCriticalCue(cue: Cue, roles: CueRole[]): boolean {
  if (cue.critical === true) return true;
  if (cue.critical === false) return false;
  return roles.includes(cue.role);
}

export function verifyCues(
  cues: Cue[],
  options: VerifyOptions = {}
): VerifyReport {
  const threshold = options.threshold ?? 15;
  const criticalRoles = options.criticalRoles ?? DEFAULT_CRITICAL;
  const critical = cues.filter((c) => isCriticalCue(c, criticalRoles));
  const pairs: PairVerdict[] = [];

  for (let i = 0; i < critical.length; i++) {
    for (let j = i + 1; j < critical.length; j++) {
      const a = critical[i];
      const b = critical[j];
      const rgbA = parseHex(a.colour);
      const rgbB = parseHex(b.colour);
      const dN = deltaE2000(rgbA, rgbB);
      const secDiff = secondaryEncodingsDiffer(a, b);

      for (const mode of CVD_MODES) {
        const dC = deltaE2000(simulateRgb(rgbA, mode), simulateRgb(rgbB, mode));
        const colourFail = dC < threshold;
        pairs.push({
          aId: a.id,
          bId: b.id,
          aLabel: a.label,
          bLabel: b.label,
          aRole: a.role,
          bRole: b.role,
          mode,
          deltaENormal: dN,
          deltaECvd: dC,
          threshold,
          colourFail,
          dualEncodingFail: colourFail && !secDiff,
          secondaryDiffer: secDiff,
          status: "PASS",
          reason: "",
        });
      }
    }
  }

  for (const p of pairs) {
    if (p.colourFail && !p.secondaryDiffer) {
      p.status = "FAIL";
      p.dualEncodingFail = true;
      p.reason = `FAIL — ${p.aLabel} vs ${p.bLabel}: ΔE ${p.deltaENormal.toFixed(1)} → ${p.deltaECvd.toFixed(1)} under ${p.mode} (threshold ${p.threshold}). No non-colour backup.`;
    } else if (p.colourFail && p.secondaryDiffer) {
      p.status = "PASS";
      p.dualEncodingFail = false;
      p.reason = `PASS (dual-encoding rescue) — ${p.aLabel} vs ${p.bLabel}: hue ΔE ${p.deltaENormal.toFixed(1)} → ${p.deltaECvd.toFixed(1)} under ${p.mode}, secondary encodings differ.`;
    } else {
      p.status = "PASS";
      p.reason = `PASS — ${p.aLabel} vs ${p.bLabel}: ΔE ${p.deltaENormal.toFixed(1)} → ${p.deltaECvd.toFixed(1)} under ${p.mode}.`;
    }
  }

  const failCount = pairs.filter((p) => p.status === "FAIL").length;
  const passCount = pairs.filter((p) => p.status === "PASS").length;

  return {
    version: "1.0",
    tool: "CueLock",
    generatedAt: new Date().toISOString(),
    model: "Machado et al. 2009",
    deltaE: "CIEDE2000",
    threshold,
    cues: cues.map((c) => ({ ...c })),
    pairs,
    summary: {
      pass: failCount === 0,
      failCount,
      passCount,
      colourOnlyFails: pairs.filter((p) => p.dualEncodingFail).length,
      deltaEFails: pairs.filter((p) => p.colourFail).length,
    },
  };
}

/** Concrete Fix mutations — must visibly change map encodings. */
export function applySafeEncoding(cues: Cue[]): Cue[] {
  const main = cues.find((c) => c.role === "route_active");
  const mainWidth = Math.max(main?.secondaryEncoding.width ?? 4, 4);
  const backupWidth = Math.max(mainWidth + 3, 7);

  return cues.map((c) => {
    if (c.role === "route_active") {
      return {
        ...c,
        secondaryEncoding: {
          pattern: "solid",
          width: mainWidth,
          icon: undefined,
          labelOnMap: false,
        },
      };
    }
    if (c.role === "route_alt") {
      return {
        ...c,
        secondaryEncoding: {
          pattern: "dashed",
          width: backupWidth,
          icon: undefined,
          labelOnMap: false,
        },
      };
    }
    if (c.role === "hazard") {
      return {
        ...c,
        secondaryEncoding: {
          pattern: "solid",
          width: c.secondaryEncoding.width ?? 4,
          icon: "triangle",
          labelOnMap: true,
        },
      };
    }
    if (c.role === "destination") {
      return {
        ...c,
        secondaryEncoding: {
          pattern: "solid",
          width: c.secondaryEncoding.width ?? 4,
          icon: "circle",
          labelOnMap: true,
        },
      };
    }
    return { ...c, secondaryEncoding: { ...c.secondaryEncoding } };
  });
}
