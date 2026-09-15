/**
 * Human + machine exports: evidence PNG, Markdown, JSON, testing report.
 */

import {
  buildProblems,
  describeEncoding,
  describeSafeChanges,
  FRIENDLY_ROLE,
  plainSummary,
  VISION_PLAIN,
  type PlainProblem,
} from "./plainEnglish";
import type { Cue, VerifyReport } from "./types";
import { cueStatusByMode } from "./status";

export type ReportContext = {
  demo?: "melbourne" | "custom" | "unknown";
  appUrl?: string;
  mapCenter?: [number, number];
  mapZoom?: number;
  fixChanges?: string[];
  cuesBeforeFix?: Cue[];
};

export function enrichForExport(report: VerifyReport) {
  const problems = buildProblems(report);
  const summary = plainSummary(report, problems);
  return { problems, summary };
}

export function reportToPublicJson(
  report: VerifyReport,
  ctx: ReportContext = {}
) {
  const { problems, summary } = enrichForExport(report);
  return {
    ...report,
    summary: {
      ...report.summary,
      result: summary.result,
      plainEnglish: summary.plainEnglish,
      problemCount: summary.problemCount,
      passCount: summary.passCount,
    },
    problems: problems.map((p) => ({
      title: p.title,
      affects: p.affects,
      affectsPlain: p.affectsPlain,
      pair: p.pair,
      deltaEBefore: Number(p.deltaEBefore.toFixed(1)),
      deltaEAfter: Number(p.deltaEAfter.toFixed(1)),
      threshold: p.threshold,
      fixPlain: p.fixPlain,
      whatHappens: p.whatHappens,
      proofPlain: p.proofPlain,
    })),
    meta: {
      demo: ctx.demo ?? "unknown",
      fixChanges: ctx.fixChanges ?? [],
    },
  };
}

export function reportToMarkdown(
  report: VerifyReport,
  ctx: ReportContext = {}
): string {
  const { problems, summary } = enrichForExport(report);
  const top = problems.slice(0, 5);
  const lines: string[] = [
    `# CueLock report`,
    ``,
    `**${summary.result === "pass" ? "PASS" : "FAIL"}** · ${ctx.demo === "melbourne" ? "Scintilla / Melbourne demo" : "Custom map"} · ${report.generatedAt}`,
    ``,
    `## Plain summary`,
    ``,
    `We checked whether main route, backup route, hazard, and destination stay distinguishable for people with red-blind, green-blind, and blue-blind vision.`,
    ``,
    summary.result === "fail"
      ? `Result: ${summary.problemCount} problems. Navigation meaning can collapse when colour is the only difference.`
      : `Result: all critical route meanings stay clear when colour-blind vision is simulated.`,
    ``,
  ];

  if (top.length) {
    lines.push(`## Problems`, ``);
    for (const p of top) {
      lines.push(`### ${p.title}`);
      lines.push(`- **Who it affects:** ${p.affectsPlain}`);
      lines.push(`- **What happens:** ${p.whatHappens}`);
      lines.push(`- **Proof:** ${p.proofPlain}`);
      lines.push(`- **Fix:** ${p.fixPlain}`);
      lines.push(`- Technical: ${p.technicalLine}`);
      lines.push(``);
    }
  }

  if (ctx.fixChanges?.length) {
    lines.push(`## What we changed`, ``);
    for (const c of ctx.fixChanges) lines.push(`- ${c}`);
    lines.push(``);
  }

  lines.push(
    `---`,
    `Neer Vasa · Monash MIT · scintilla.world · github.com/neervasa00000000`,
    `Method: Machado et al. 2009 CVD simulation · CIEDE2000 · dual-encoding rule`,
    `Note: research instrument, not a WCAG certificate.`
  );
  return lines.join("\n");
}

export function buildTestingReport(
  report: VerifyReport,
  ctx: ReportContext & {
    userAgent?: string;
    viewport?: string;
  } = {}
): string {
  const problems = buildProblems(report);
  const lines: string[] = [
    `# CueLock testing report`,
    `Generated: ${report.generatedAt}`,
    `App URL: ${ctx.appUrl ?? "(unknown)"}`,
    `Demo: ${ctx.demo ?? "unknown"}`,
    `Result: ${report.summary.pass ? "PASS" : "FAIL"}`,
    `Threshold ΔE: ${report.threshold}`,
    `Model: Machado 2009 + CIEDE2000`,
    `Dual-encoding rule: on`,
    ``,
    `## Summary counts`,
    `- Critical pairs checked: ${report.pairs.length}`,
    `- Passing: ${report.summary.passCount}`,
    `- Failing: ${report.summary.failCount}`,
    `- Colour-only collapses: ${report.summary.colourOnlyFails}`,
    ``,
    `## Cues (full state)`,
  ];

  for (const c of report.cues) {
    const st = cueStatusByMode(report, c.id);
    lines.push(
      `- id: ${c.id}`,
      `  - role: ${c.role} (${FRIENDLY_ROLE[c.role]})`,
      `  - label: ${c.label}`,
      `  - colour: ${c.colour}`,
      `  - secondaryEncoding: ${describeEncoding(c.secondaryEncoding)}`,
      `  - geometryRef: ${c.geometryRef ?? "—"}`,
      `  - P/D/T: ${st.protanopia}/${st.deuteranopia}/${st.tritanopia}`,
      ``
    );
  }

  lines.push(`## Failures (each one fully detailed)`, ``);
  if (!problems.length) {
    lines.push(`(none)`, ``);
  }
  for (const [i, p] of problems.entries()) {
    const a = report.cues.find((c) => c.id === p.verdict.aId)!;
    const b = report.cues.find((c) => c.id === p.verdict.bId)!;
    lines.push(
      `### ${i + 1}. ${p.title}`,
      `1. pair: ${p.pair[0]} (${p.pairLabels[0]}) vs ${p.pair[1]} (${p.pairLabels[1]})`,
      `2. vision mode: ${p.affects}`,
      `3. colours: ${p.colours[0]} vs ${p.colours[1]}`,
      `4. ΔE normal: ${p.deltaEBefore.toFixed(1)}`,
      `5. ΔE under CVD: ${p.deltaEAfter.toFixed(1)}`,
      `6. threshold: ${p.threshold}`,
      `7. secondary A: ${describeEncoding(a.secondaryEncoding)}`,
      `   secondary B: ${describeEncoding(b.secondaryEncoding)}`,
      `   identical: ${p.secondaryIdentical ? "yes" : "no"}`,
      `8. reason: colour-only collapse · ${p.whatHappens}`,
      `9. suggested fix: ${p.fixPlain}`,
      `10. reproduction: Open Melbourne demo → Check (auto-runs). Look for this pair under ${p.affects}.`,
      ``
    );
  }

  lines.push(`## Passing critical pairs (short list)`, ``);
  for (const p of report.pairs.filter((x) => x.status === "PASS").slice(0, 24)) {
    lines.push(
      `- ${p.aRole} vs ${p.bRole} · ${p.mode} · ΔE_cvd ${p.deltaECvd.toFixed(1)} · ok`
    );
  }
  lines.push(``);

  lines.push(
    `## Environment`,
    `- userAgent: ${ctx.userAgent ?? "(n/a)"}`,
    `- viewport: ${ctx.viewport ?? "(n/a)"}`,
    `- map center/zoom: ${ctx.mapCenter ? ctx.mapCenter.join(",") : "n/a"} / ${ctx.mapZoom ?? "n/a"}`,
    `- sample route: ${ctx.demo === "melbourne" ? "Flinders St → Melbourne Central" : "n/a"}`,
    ``,
    `## Raw JSON`,
    "```json",
    JSON.stringify(reportToPublicJson(report, ctx), null, 2),
    "```",
    ``
  );

  return lines.join("\n");
}

export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJson(report: VerifyReport, ctx?: ReportContext) {
  downloadText(
    "cuelock-report.json",
    JSON.stringify(reportToPublicJson(report, ctx), null, 2),
    "application/json"
  );
}

export function downloadMarkdown(report: VerifyReport, ctx?: ReportContext) {
  downloadText(
    "cuelock-report.md",
    reportToMarkdown(report, ctx),
    "text/markdown"
  );
}

export function downloadTestingReport(
  report: VerifyReport,
  ctx?: Parameters<typeof buildTestingReport>[1]
) {
  downloadText(
    "cuelock-testing-report.md",
    buildTestingReport(report, ctx),
    "text/markdown"
  );
}

export async function copyTestingReport(
  report: VerifyReport,
  ctx?: Parameters<typeof buildTestingReport>[1]
) {
  const text = buildTestingReport(report, ctx);
  await navigator.clipboard.writeText(text);
  return text;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, yy);
    yy += lineHeight;
  }
  return yy;
}

export async function exportEvidencePng(
  report: VerifyReport,
  opts: {
    mapDataUrl?: string | null;
    demo?: string;
    fixChanges?: string[];
  } = {}
): Promise<Blob> {
  const { problems, summary } = enrichForExport(report);
  const top = problems.slice(0, 5);
  const W = 1100;
  const PAD = 40;
  const mapH = opts.mapDataUrl ? 220 : 0;
  const problemBlock = top.length * 92;
  const fixBlock = opts.fixChanges?.length
    ? 28 + opts.fixChanges.length * 18
    : 0;
  const H =
    PAD +
    120 +
    70 +
    mapH +
    24 +
    28 +
    problemBlock +
    fixBlock +
    70 +
    PAD;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.max(H, 900);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0f1113";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = PAD;

  // Header
  ctx.fillStyle = "#e8eaed";
  ctx.font = "600 24px Inter, system-ui, sans-serif";
  ctx.fillText("CueLock report", PAD, y + 8);
  y += 32;

  ctx.fillStyle = "#8b929a";
  ctx.font = "400 13px Inter, system-ui, sans-serif";
  ctx.fillText(
    `${opts.demo === "melbourne" || !opts.demo ? "Scintilla / Melbourne demo" : opts.demo} · ${report.generatedAt}`,
    PAD,
    y
  );
  y += 28;

  // Big result
  const pass = summary.result === "pass";
  roundRect(ctx, PAD, y - 4, pass ? 120 : 100, 32, 4);
  ctx.fillStyle = pass ? "#6a9a78" : "#c45c5c";
  ctx.fill();
  ctx.fillStyle = "#0f1113";
  ctx.font = "700 14px Inter, system-ui, sans-serif";
  ctx.fillText(pass ? "PASS" : "FAIL", PAD + 14, y + 17);
  y += 48;

  // Plain summary
  ctx.fillStyle = "#c5cad0";
  ctx.font = "400 13px Inter, system-ui, sans-serif";
  y =
    wrapText(
      ctx,
      "We checked whether main route, backup route, hazard, and destination stay distinguishable for people with red-blind, green-blind, and blue-blind vision.",
      PAD,
      y,
      W - PAD * 2,
      18
    ) + 6;
  ctx.fillStyle = "#e8eaed";
  ctx.font = "500 14px Inter, system-ui, sans-serif";
  y =
    wrapText(
      ctx,
      pass
        ? "Result: all critical route meanings stay clear."
        : `Result: ${summary.problemCount} problems. Navigation meaning can collapse when colour is the only difference.`,
      PAD,
      y,
      W - PAD * 2,
      20
    ) + 16;

  // Map snapshot
  if (opts.mapDataUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = opts.mapDataUrl!;
      });
      const mw = W - PAD * 2;
      const mh = mapH;
      roundRect(ctx, PAD, y, mw, mh, 6);
      ctx.fillStyle = "#171a1d";
      ctx.fill();
      const sc = Math.min(mw / img.width, mh / img.height);
      const dw = img.width * sc;
      const dh = img.height * sc;
      ctx.drawImage(img, PAD + (mw - dw) / 2, y + (mh - dh) / 2, dw, dh);

      // Annotation labels (plain words)
      ctx.font = "600 11px Inter, system-ui, sans-serif";
      const callouts = [...new Set(top.map((p) => p.mapCallout))].slice(0, 3);
      callouts.forEach((c, i) => {
        const lx = PAD + 12;
        const ly = y + 18 + i * 22;
        ctx.fillStyle = "rgba(196,92,92,0.92)";
        roundRect(ctx, lx, ly - 12, Math.min(320, ctx.measureText(c).width + 16), 18, 3);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(c, lx + 8, ly);
      });
      y += mh + 20;
    } catch {
      y += 8;
    }
  }

  // Problems
  ctx.fillStyle = "#c5cad0";
  ctx.font = "600 14px Inter, system-ui, sans-serif";
  ctx.fillText(pass ? "Checks" : "Problems", PAD, y);
  y += 22;

  const drawProblem = (p: PlainProblem) => {
    ctx.fillStyle = "#e8eaed";
    ctx.font = "600 13px Inter, system-ui, sans-serif";
    ctx.fillText(p.title, PAD, y);
    y += 18;

    // swatches
    ctx.fillStyle = p.colours[0];
    ctx.fillRect(PAD, y - 8, 18, 14);
    ctx.fillStyle = p.colours[1];
    ctx.fillRect(PAD + 22, y - 8, 18, 14);
    ctx.fillStyle = "#5c6570";
    ctx.font = "400 10px Inter, system-ui, sans-serif";
    ctx.fillText("normal", PAD + 48, y + 2);
    ctx.fillStyle = p.coloursUnderMode[0];
    ctx.fillRect(PAD + 100, y - 8, 18, 14);
    ctx.fillStyle = p.coloursUnderMode[1];
    ctx.fillRect(PAD + 122, y - 8, 18, 14);
    ctx.fillStyle = "#5c6570";
    ctx.fillText(
      `under ${VISION_PLAIN[p.affects].short}`,
      PAD + 148,
      y + 2
    );
    y += 18;

    ctx.fillStyle = "#8b929a";
    ctx.font = "400 12px Inter, system-ui, sans-serif";
    y = wrapText(ctx, `${p.affectsPlain}. ${p.fixPlain}`, PAD, y, W - PAD * 2, 16);
    ctx.fillStyle = "#5c6570";
    ctx.font = "400 10px ui-monospace, Menlo, monospace";
    ctx.fillText(p.technicalLine, PAD, y + 2);
    y += 22;
  };

  if (top.length) {
    for (const p of top) drawProblem(p);
  } else {
    ctx.fillStyle = "#8b929a";
    ctx.font = "400 12px Inter, system-ui, sans-serif";
    ctx.fillText("No colour-only collapses under the dual-encoding rule.", PAD, y);
    y += 24;
  }

  if (opts.fixChanges?.length) {
    ctx.fillStyle = "#c5cad0";
    ctx.font = "600 14px Inter, system-ui, sans-serif";
    ctx.fillText("What we changed", PAD, y);
    y += 18;
    ctx.fillStyle = "#8b929a";
    ctx.font = "400 12px Inter, system-ui, sans-serif";
    for (const c of opts.fixChanges) {
      ctx.fillText(`• ${c}`, PAD, y);
      y += 18;
    }
  }

  // Footer
  const fy = canvas.height - 48;
  ctx.strokeStyle = "#2a2f36";
  ctx.beginPath();
  ctx.moveTo(PAD, fy - 10);
  ctx.lineTo(W - PAD, fy - 10);
  ctx.stroke();
  ctx.fillStyle = "#8b929a";
  ctx.font = "400 11px Inter, system-ui, sans-serif";
  ctx.fillText(
    "Neer Vasa · Monash MIT · scintilla.world · github.com/neervasa00000000",
    PAD,
    fy
  );
  ctx.fillStyle = "#5c6570";
  ctx.font = "400 10px Inter, system-ui, sans-serif";
  ctx.fillText(
    "Method: Machado et al. 2009 CVD simulation · CIEDE2000 · dual-encoding rule",
    PAD,
    fy + 16
  );
  ctx.fillText(
    "Note: research instrument, not a WCAG certificate.",
    PAD,
    fy + 30
  );

  void describeSafeChanges;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("PNG export failed"))),
      "image/png"
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function failingCueIds(report: VerifyReport): Set<string> {
  const ids = new Set<string>();
  for (const p of report.pairs) {
    if (p.status === "FAIL") {
      ids.add(p.aId);
      ids.add(p.bId);
    }
  }
  return ids;
}

export { cueStatusByMode } from "./status";
export type { PlainProblem };
