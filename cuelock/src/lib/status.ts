import type { VerifyReport } from "./types";

export function cueStatusByMode(report: VerifyReport, cueId: string) {
  const out: Record<string, "PASS" | "FAIL" | "—"> = {
    protanopia: "—",
    deuteranopia: "—",
    tritanopia: "—",
  };
  for (const p of report.pairs) {
    if (p.aId !== cueId && p.bId !== cueId) continue;
    if (p.status === "FAIL") out[p.mode] = "FAIL";
    else if (out[p.mode] !== "FAIL") out[p.mode] = "PASS";
  }
  return out;
}
