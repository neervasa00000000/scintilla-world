/**
 * Single source of truth helpers for CueLock app loop.
 */

import { melbourneBadCues } from "./demo";
import { describeSafeChanges } from "./plainEnglish";
import type { Cue, VerifyReport } from "./types";
import { applySafeEncoding, verifyCues } from "./verify";

export type Phase = "idle" | "checked_fail" | "fixed" | "checked_pass";

export type AppSnapshot = {
  cues: Cue[];
  threshold: number;
  lastResult: VerifyReport | null;
  phase: Phase;
  demo: "melbourne" | "custom" | "unknown";
  fixChanges: string[];
};

export function loadMelbourneDemo(threshold = 15): AppSnapshot {
  const cues = melbourneBadCues();
  const lastResult = verifyCues(cues, { threshold });
  return {
    cues,
    threshold,
    lastResult,
    phase: lastResult.summary.pass ? "checked_pass" : "checked_fail",
    demo: "melbourne",
    fixChanges: [],
  };
}

export function runCheck(
  cues: Cue[],
  threshold: number,
  demo: AppSnapshot["demo"],
  fixChanges: string[]
): AppSnapshot {
  const lastResult = verifyCues(cues, { threshold });
  return {
    cues,
    threshold,
    lastResult,
    phase: lastResult.summary.pass ? "checked_pass" : "checked_fail",
    demo,
    fixChanges,
  };
}

/**
 * Mutate secondary encodings (escalate hazard colour if needed), then re-verify.
 * Throws if nothing changed.
 */
export function applyFix(
  cues: Cue[],
  threshold: number,
  demo: AppSnapshot["demo"]
): AppSnapshot {
  const before = cues.map((c) => structuredClone(c));
  let next = applySafeEncoding(cues);

  let report = verifyCues(next, { threshold });
  if (!report.summary.pass) {
    next = next.map((c) =>
      c.role === "hazard"
        ? {
            ...c,
            colour: "#a855f7",
            secondaryEncoding: {
              pattern: "solid" as const,
              width: c.secondaryEncoding.width ?? 4,
              icon: "triangle",
              labelOnMap: true,
            },
          }
        : c
    );
    report = verifyCues(next, { threshold });
  }

  const changes = describeSafeChanges(before, next);
  const hazardBefore = before.find((c) => c.role === "hazard");
  const hazardAfter = next.find((c) => c.role === "hazard");
  if (hazardBefore && hazardAfter && hazardBefore.colour !== hazardAfter.colour) {
    changes.push(`Hazard: colour ${hazardBefore.colour} → ${hazardAfter.colour}`);
  }

  if (changes.length === 0) {
    const err = "Fix automatically did not change any cue fields";
    console.error(err, { before, next });
    throw new Error(err);
  }
  console.assert(changes.length > 0, "Fix must mutate cue encodings");

  return {
    cues: next,
    threshold,
    lastResult: report,
    phase: report.summary.pass ? "checked_pass" : "checked_fail",
    demo,
    fixChanges: changes,
  };
}
