/**
 * Plain-English layer over verify results — does not change science.
 */

import { simulateHex } from "./cvd";
import type {
  Cue,
  CueRole,
  PairVerdict,
  SecondaryEncoding,
  VerifyReport,
} from "./types";

export const FRIENDLY_ROLE: Record<CueRole, string> = {
  route_active: "Main route",
  route_alt: "Backup route",
  hazard: "Hazard",
  destination: "Destination",
  mode_walk: "Walk mode",
  mode_transit: "Transit mode",
  legend_chip: "Legend colour",
  custom: "Custom cue",
};

export const VISION_PLAIN: Record<
  "protanopia" | "deuteranopia" | "tritanopia",
  { short: string; affects: string }
> = {
  protanopia: {
    short: "red-blind",
    affects: "People with red-blind vision (protanopia)",
  },
  deuteranopia: {
    short: "green-blind",
    affects: "People with green-blind vision (deuteranopia)",
  },
  tritanopia: {
    short: "blue-blind",
    affects: "People with blue-blind vision (tritanopia)",
  },
};

export type PlainProblem = {
  id: string;
  title: string;
  affects: "protanopia" | "deuteranopia" | "tritanopia";
  affectsPlain: string;
  whatHappens: string;
  proofPlain: string;
  fixPlain: string;
  mapCallout: string;
  pair: [CueRole, CueRole];
  pairLabels: [string, string];
  colours: [string, string];
  coloursUnderMode: [string, string];
  deltaEBefore: number;
  deltaEAfter: number;
  threshold: number;
  secondaryIdentical: boolean;
  technicalLine: string;
  verdict: PairVerdict;
};

function roleName(role: CueRole): string {
  return FRIENDLY_ROLE[role] ?? role;
}

function describeEncoding(s: SecondaryEncoding): string {
  const bits: string[] = [];
  bits.push(s.pattern ?? "solid");
  if (s.width != null && s.width > 0) bits.push(`width ${s.width}`);
  if (s.icon) bits.push(`${s.icon} icon`);
  if (s.labelOnMap) bits.push("label on map");
  else bits.push("no label");
  return bits.join(", ");
}

export function suggestFix(a: Cue, b: Cue): string {
  // Prefer fixing the "secondary" role (alt / hazard) when possible
  const fixTarget =
    b.role === "route_alt" || b.role === "hazard" || a.role === "route_active"
      ? b
      : a;
  const keep = fixTarget.id === a.id ? b : a;

  if (fixTarget.role === "route_alt") {
    return `Make ${roleName("route_alt")} dashed and a different thickness; keep ${roleName(keep.role)} solid.`;
  }
  if (fixTarget.role === "hazard") {
    return `Give ${roleName("hazard")} a triangle icon and a text label on the map — do not rely on orange alone.`;
  }
  if (fixTarget.role === "destination") {
    return `Label ${roleName("destination")} on the map and use a distinct pin shape from hazards.`;
  }
  if (fixTarget.role === "route_active") {
    return `Keep ${roleName("route_active")} solid and thicker; change the other cue’s pattern or icon.`;
  }
  return `Change pattern, thickness, icon, or on-map label for ${roleName(fixTarget.role)} so it differs from ${roleName(keep.role)}.`;
}

export function problemTitle(p: PairVerdict): string {
  const a = roleName(p.aRole);
  const b = roleName(p.bRole);
  if (
    (p.aRole === "route_active" && p.bRole === "route_alt") ||
    (p.aRole === "route_alt" && p.bRole === "route_active")
  ) {
    return "Main route and backup route look the same";
  }
  if (p.aRole === "hazard" || p.bRole === "hazard") {
    const other =
      p.aRole === "hazard" ? roleName(p.bRole) : roleName(p.aRole);
    return `Hazard may be confused with ${other.toLowerCase()}`;
  }
  if (p.aRole === "destination" || p.bRole === "destination") {
    return `${a} and ${b} become hard to tell apart`;
  }
  return `${a} and ${b} look the same`;
}

export function mapCallout(p: PairVerdict): string {
  if (
    (p.aRole === "route_active" && p.bRole === "route_alt") ||
    (p.aRole === "route_alt" && p.bRole === "route_active")
  ) {
    return "These two routes look too similar";
  }
  if (p.aRole === "hazard" || p.bRole === "hazard") {
    return "Hazard may be missed";
  }
  return "These markers look too similar";
}

export function whatHappens(p: PairVerdict, cues: Cue[]): string {
  const ca = cues.find((c) => c.id === p.aId);
  const cb = cues.find((c) => c.id === p.bId);
  const aCol = ca?.colour ?? "";
  const bCol = cb?.colour ?? "";
  const vision = VISION_PLAIN[p.mode].short;
  return `Under ${vision} vision, ${roleName(p.aRole).toLowerCase()} (${aCol}) and ${roleName(p.bRole).toLowerCase()} (${bCol}) become hard to tell apart when colour is the only difference.`;
}

export function buildProblems(
  report: VerifyReport
): PlainProblem[] {
  const fails = report.pairs.filter((p) => p.status === "FAIL");
  // Deduplicate by pair+mode already unique; sort by collapse severity
  const sorted = [...fails].sort(
    (a, b) => a.deltaECvd / a.deltaENormal - b.deltaECvd / b.deltaENormal
  );

  return sorted.flatMap((p) => {
    const ca = report.cues.find((c) => c.id === p.aId);
    const cb = report.cues.find((c) => c.id === p.bId);
    if (!ca || !cb) return [];
    const title = problemTitle(p);
    return [{
      id: `${p.aId}-${p.bId}-${p.mode}`,
      title,
      affects: p.mode,
      affectsPlain: VISION_PLAIN[p.mode].affects,
      whatHappens: whatHappens(p, report.cues),
      proofPlain: `Colour difference drops from ${p.deltaENormal.toFixed(0)} to ${p.deltaECvd.toFixed(0)} (need at least ${p.threshold})`,
      fixPlain: suggestFix(ca, cb),
      mapCallout: mapCallout(p),
      pair: [p.aRole, p.bRole],
      pairLabels: [roleName(p.aRole), roleName(p.bRole)],
      colours: [ca.colour, cb.colour],
      coloursUnderMode: [
        simulateHex(ca.colour, p.mode),
        simulateHex(cb.colour, p.mode),
      ],
      deltaEBefore: p.deltaENormal,
      deltaEAfter: p.deltaECvd,
      threshold: p.threshold,
      secondaryIdentical: !p.secondaryDiffer,
      technicalLine: `ΔE ${p.deltaENormal.toFixed(1)} → ${p.deltaECvd.toFixed(1)} under ${p.mode} (threshold ${p.threshold})`,
      verdict: p,
    }];
  });
}

export function plainSummary(report: VerifyReport, problems: PlainProblem[]): {
  result: "fail" | "pass";
  plainEnglish: string;
  headline: string;
  subline: string;
  problemCount: number;
  passCount: number;
} {
  const problemCount = problems.length;
  const passCount = report.summary.passCount;
  if (report.summary.pass) {
    return {
      result: "pass",
      plainEnglish:
        "All critical route meanings stay clear for colour-blind users.",
      headline: "All critical route meanings stay clear for colour-blind users.",
      subline: "Checked for red-blind, green-blind, and blue-blind vision.",
      problemCount: 0,
      passCount,
    };
  }
  return {
    result: "fail",
    plainEnglish: `${problemCount} problem${problemCount === 1 ? "" : "s"} found. Some routes or markers look the same for colour-blind users.`,
    headline: `${problemCount} problem${problemCount === 1 ? "" : "s"} found. Some routes or markers look the same for colour-blind users.`,
    subline: "Checked for red-blind, green-blind, and blue-blind vision.",
    problemCount,
    passCount,
  };
}

export function describeSafeChanges(
  before: Cue[],
  after: Cue[]
): string[] {
  const lines: string[] = [];
  for (const a of after) {
    const b = before.find((c) => c.id === a.id);
    if (!b) continue;
    const changes: string[] = [];
    const bs = b.secondaryEncoding;
    const as = a.secondaryEncoding;
    if ((bs.pattern ?? "solid") !== (as.pattern ?? "solid")) {
      changes.push(`pattern ${bs.pattern ?? "solid"} → ${as.pattern ?? "solid"}`);
    }
    if ((bs.width ?? 0) !== (as.width ?? 0)) {
      changes.push(`width ${bs.width ?? 0} → ${as.width ?? 0}`);
    }
    if ((bs.icon ?? "") !== (as.icon ?? "")) {
      changes.push(`icon ${bs.icon || "none"} → ${as.icon || "none"}`);
    }
    if (!!bs.labelOnMap !== !!as.labelOnMap) {
      changes.push(
        `label on map ${bs.labelOnMap ? "on" : "off"} → ${as.labelOnMap ? "on" : "off"}`
      );
    }
    if (changes.length) {
      lines.push(`${roleName(a.role)}: ${changes.join("; ")}`);
    }
  }
  return lines;
}

export function encodingLine(c: Cue): string {
  return `${roleName(c.role)} · ${c.colour} · ${describeEncoding(c.secondaryEncoding)}`;
}

export { describeEncoding };
