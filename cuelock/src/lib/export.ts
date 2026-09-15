/**
 * Export: evidence PNG, JSON report, Markdown summary.
 */

import { simulateHex } from "./cvd";
import type { Cue, VerifyReport } from "./types";
import { CVD_MODES } from "./types";

export function reportToMarkdown(report: VerifyReport): string {
  const lines: string[] = [
    `# CueLock report`,
    ``,
    `- Generated: ${report.generatedAt}`,
    `- Model: ${report.model} · ${report.deltaE}`,
    `- Threshold: ΔE ${report.threshold}`,
    `- Result: **${report.summary.pass ? "PASS" : "FAIL"}** (${report.summary.failCount} failing pair×mode checks)`,
    ``,
    `## Cues`,
    ``,
    `| Role | Label | Colour | Pattern | Width | Icon | Label on map |`,
    `| --- | --- | --- | --- | --- | --- | --- |`,
  ];
  for (const c of report.cues) {
    const s = c.secondaryEncoding;
    lines.push(
      `| ${c.role} | ${c.label} | \`${c.colour}\` | ${s.pattern ?? "solid"} | ${s.width ?? "—"} | ${s.icon ?? "—"} | ${s.labelOnMap ? "yes" : "no"} |`
    );
  }
  lines.push(``, `## Critical pair results`, ``);
  const fails = report.pairs.filter((p) => p.status === "FAIL");
  const passes = report.pairs.filter((p) => p.status === "PASS");
  if (fails.length) {
    lines.push(`### FAIL`, ``);
    for (const p of fails) {
      lines.push(`- **${p.aLabel}** vs **${p.bLabel}** · ${p.mode}: ΔE ${p.deltaENormal.toFixed(1)} → ${p.deltaECvd.toFixed(1)} — ${p.reason}`);
    }
    lines.push(``);
  }
  lines.push(`### PASS (${passes.length})`, ``);
  for (const p of passes.slice(0, 12)) {
    lines.push(`- ${p.aLabel} vs ${p.bLabel} · ${p.mode}: ΔE ${p.deltaENormal.toFixed(1)} → ${p.deltaECvd.toFixed(1)}`);
  }
  if (passes.length > 12) lines.push(`- … ${passes.length - 12} more`);
  lines.push(
    ``,
    `---`,
    `CueLock · Neer Vasa · Monash MIT · scintilla.world`,
    `Heuristic research instrument — not a formal WCAG audit.`
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

export function downloadJson(report: VerifyReport) {
  downloadText(
    "cuelock-report.json",
    JSON.stringify(report, null, 2),
    "application/json"
  );
}

export function downloadMarkdown(report: VerifyReport) {
  downloadText("cuelock-report.md", reportToMarkdown(report), "text/markdown");
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

export async function exportEvidencePng(
  report: VerifyReport,
  mapDataUrl?: string | null
): Promise<Blob> {
  const W = 1200;
  const fails = report.pairs.filter((p) => p.status === "FAIL");
  const show = fails.length ? fails.slice(0, 6) : report.pairs.slice(0, 4);
  const cueRows = report.cues.length;
  const H = 160 + (mapDataUrl ? 280 : 0) + cueRows * 28 + 40 + show.length * 48 + 80;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0f1113";
  ctx.fillRect(0, 0, W, H);

  const PAD = 36;
  ctx.fillStyle = "#e8eaed";
  ctx.font = "600 22px Inter, system-ui, sans-serif";
  ctx.fillText("CueLock evidence card", PAD, PAD + 8);

  ctx.fillStyle = report.summary.pass ? "#6a9a78" : "#c45c5c";
  ctx.font = "700 14px ui-monospace, Menlo, monospace";
  ctx.fillText(
    report.summary.pass ? "VERIFY PASS" : `VERIFY FAIL · ${report.summary.failCount} checks`,
    PAD,
    PAD + 36
  );

  ctx.fillStyle = "#8b929a";
  ctx.font = "400 11px ui-monospace, Menlo, monospace";
  ctx.fillText(
    `${report.generatedAt} · ${report.model} · ${report.deltaE} · threshold ${report.threshold}`,
    PAD,
    PAD + 56
  );

  let y = PAD + 80;

  if (mapDataUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = mapDataUrl;
      });
      const mh = 260;
      const mw = W - PAD * 2;
      const sc = Math.min(mw / img.width, mh / img.height);
      const dw = img.width * sc;
      const dh = img.height * sc;
      roundRect(ctx, PAD, y, mw, mh, 4);
      ctx.fillStyle = "#171a1d";
      ctx.fill();
      ctx.drawImage(img, PAD + (mw - dw) / 2, y + (mh - dh) / 2, dw, dh);
      y += mh + 20;
    } catch {
      /* skip map snapshot */
    }
  }

  ctx.fillStyle = "#c5cad0";
  ctx.font = "600 13px Inter, system-ui, sans-serif";
  ctx.fillText("Cues", PAD, y);
  y += 18;

  for (const c of report.cues) {
    ctx.fillStyle = c.colour;
    ctx.fillRect(PAD, y - 10, 14, 14);
    ctx.strokeStyle = "#2a2f36";
    ctx.strokeRect(PAD, y - 10, 14, 14);
    ctx.fillStyle = "#e8eaed";
    ctx.font = "500 12px Inter, system-ui, sans-serif";
    ctx.fillText(`${c.role} · ${c.label}`, PAD + 22, y);
    ctx.fillStyle = "#8b929a";
    ctx.font = "400 11px ui-monospace, Menlo, monospace";
    const s = c.secondaryEncoding;
    ctx.fillText(
      `${c.colour}  ${s.pattern ?? "solid"}  w${s.width ?? 0}  ${s.icon ?? "—"}  label:${s.labelOnMap ? "y" : "n"}`,
      PAD + 22,
      y + 14
    );
    // CVD swatches
    let sx = W - PAD - 120;
    for (const mode of CVD_MODES) {
      ctx.fillStyle = simulateHex(c.colour, mode);
      ctx.fillRect(sx, y - 8, 12, 12);
      sx += 16;
    }
    y += 28;
  }

  y += 12;
  ctx.fillStyle = "#c5cad0";
  ctx.font = "600 13px Inter, system-ui, sans-serif";
  ctx.fillText(fails.length ? "Failures" : "Sample results", PAD, y);
  y += 20;

  for (const p of show) {
    ctx.fillStyle = p.status === "FAIL" ? "#c45c5c" : "#6a9a78";
    ctx.fillRect(PAD, y - 10, 44, 16);
    ctx.fillStyle = "#0f1113";
    ctx.font = "700 9px Inter, system-ui, sans-serif";
    ctx.fillText(p.status, PAD + 6, y + 1);

    ctx.fillStyle = "#e8eaed";
    ctx.font = "500 12px Inter, system-ui, sans-serif";
    ctx.fillText(`${p.aLabel}  vs  ${p.bLabel}`, PAD + 54, y);

    ctx.fillStyle = "#8b929a";
    ctx.font = "400 11px ui-monospace, Menlo, monospace";
    ctx.fillText(
      `${p.mode}  ΔE ${p.deltaENormal.toFixed(1)} → ${p.deltaECvd.toFixed(1)}  thr ${p.threshold}`,
      PAD + 54,
      y + 16
    );
    y += 48;
  }

  const fy = H - 40;
  ctx.strokeStyle = "#2a2f36";
  ctx.beginPath();
  ctx.moveTo(PAD, fy - 12);
  ctx.lineTo(W - PAD, fy - 12);
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
    "Heuristic research instrument — not a formal WCAG audit.",
    PAD,
    fy + 16
  );

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

export type { Cue };
