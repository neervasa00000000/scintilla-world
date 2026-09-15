/**
 * Evidence-style report export (PNG).
 */

import { rgbCss, rgbHex } from "./color";
import { CVD_LABELS, type CompareSummary, type ConfusablePair, type CvdMode, type ImageDoc } from "./types";
import { unionBBox } from "./analysis";

function loadUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
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

function drawCrop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  finding: ConfusablePair,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const box = unionBBox(finding.a.bbox, finding.b.bbox);
  const pad = Math.max(8, Math.round(Math.max(box.w, box.h) * 0.25));
  const sx = Math.max(0, box.x - pad);
  const sy = Math.max(0, box.y - pad);
  const sw = Math.min(img.width - sx, box.w + pad * 2);
  const sh = Math.min(img.height - sy, box.h + pad * 2);

  ctx.save();
  roundRect(ctx, x, y, w, h, 4);
  ctx.clip();
  ctx.fillStyle = "#0f1113";
  ctx.fillRect(x, y, w, h);
  const scale = Math.min(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

  // annotate boxes in crop space
  const mapX = (px: number) => dx + (px - sx) * scale;
  const mapY = (py: number) => dy + (py - sy) * scale;
  for (const c of [finding.a, finding.b]) {
    ctx.strokeStyle = "#d4a017";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      mapX(c.bbox.x),
      mapY(c.bbox.y),
      c.bbox.w * scale,
      c.bbox.h * scale
    );
  }
  ctx.restore();
}

export async function exportReportPng(opts: {
  doc: ImageDoc;
  compare?: { other: ImageDoc; summary: CompareSummary } | null;
}): Promise<Blob> {
  const { doc, compare } = opts;
  const W = 1400;
  const PAD = 40;
  const modes: CvdMode[] = ["normal", "protanopia", "deuteranopia", "tritanopia"];

  const topFindings = doc.findings.filter((f) => f.severity !== "low").slice(0, 4);
  const showFindings = topFindings.length
    ? topFindings
    : doc.findings.slice(0, 3);

  const headerH = 96;
  const simH = 200;
  const cropH = showFindings.length ? 210 : 0;
  const findingsTextH = showFindings.length * 52 + 40;
  const compareH = compare ? 56 : 0;
  const footerH = 64;
  const H =
    PAD +
    headerH +
    simH +
    24 +
    cropH +
    16 +
    findingsTextH +
    compareH +
    footerH +
    PAD;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0f1113";
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.fillStyle = "#e8eaed";
  ctx.font = "600 22px Inter, system-ui, sans-serif";
  ctx.fillText("See-the-Route report", PAD, PAD + 24);

  const ts = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  ctx.fillStyle = "#8b929a";
  ctx.font = "400 12px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(`Source: ${doc.name}`, PAD, PAD + 48);
  ctx.fillText(`Generated: ${ts}`, PAD, PAD + 66);
  ctx.fillText(
    "CVD model: Machado, Oliveira & Fernandes (2009) · ΔE: CIEDE2000",
    PAD,
    PAD + 84
  );

  // Simulation grid
  const gap = 12;
  const cellW = (W - PAD * 2 - gap * 3) / 4;
  let x = PAD;
  const y0 = PAD + headerH;
  const imgs = await Promise.all(modes.map((m) => loadUrl(doc.sims[m])));

  for (let i = 0; i < modes.length; i++) {
    const img = imgs[i];
    roundRect(ctx, x, y0, cellW, simH, 4);
    ctx.fillStyle = "#171a1d";
    ctx.fill();
    ctx.strokeStyle = "#2a2f36";
    ctx.stroke();

    const iw = cellW - 8;
    const ih = simH - 28;
    const sc = Math.min(iw / img.width, ih / img.height);
    const dw = img.width * sc;
    const dh = img.height * sc;
    ctx.drawImage(
      img,
      x + 4 + (iw - dw) / 2,
      y0 + 4 + (ih - dh) / 2,
      dw,
      dh
    );
    ctx.fillStyle = "#9aa1a9";
    ctx.font = "500 11px Inter, system-ui, sans-serif";
    ctx.fillText(CVD_LABELS[modes[i]], x + 8, y0 + simH - 8);
    x += cellW + gap;
  }

  let cursorY = y0 + simH + 24;
  const srcImg = await loadUrl(doc.url);

  if (showFindings.length) {
    ctx.fillStyle = "#c5cad0";
    ctx.font = "600 13px Inter, system-ui, sans-serif";
    ctx.fillText("Annotated failure regions", PAD, cursorY);
    cursorY += 14;

    const cropW = (W - PAD * 2 - gap * (showFindings.length - 1)) / showFindings.length;
    const cropBoxH = 140;
    for (let i = 0; i < showFindings.length; i++) {
      const f = showFindings[i];
      const cx = PAD + i * (cropW + gap);
      drawCrop(ctx, srcImg, f, cx, cursorY, cropW, cropBoxH);
      ctx.fillStyle = "#8b929a";
      ctx.font = "400 10px ui-monospace, Menlo, monospace";
      const label = f.metric.length > 42 ? f.metric.slice(0, 40) + "…" : f.metric;
      ctx.fillText(label, cx, cursorY + cropBoxH + 14);
    }
    cursorY += cropBoxH + 28;

    ctx.fillStyle = "#c5cad0";
    ctx.font = "600 13px Inter, system-ui, sans-serif";
    ctx.fillText("Findings", PAD, cursorY);
    cursorY += 18;

    for (const f of showFindings) {
      const sev =
        f.severity === "high"
          ? "#c45c5c"
          : f.severity === "medium"
            ? "#c49a3c"
            : "#6a9a78";
      ctx.fillStyle = sev;
      ctx.fillRect(PAD, cursorY - 10, 52, 16);
      ctx.fillStyle = "#0f1113";
      ctx.font = "700 9px Inter, system-ui, sans-serif";
      ctx.fillText(f.severity.toUpperCase(), PAD + 6, cursorY + 1);

      ctx.fillStyle = "#e8eaed";
      ctx.font = "500 12px Inter, system-ui, sans-serif";
      ctx.fillText(f.title.slice(0, 90), PAD + 62, cursorY);

      ctx.fillStyle = "#8b929a";
      ctx.font = "400 11px ui-monospace, Menlo, monospace";
      ctx.fillText(f.metric, PAD + 62, cursorY + 16);
      cursorY += 52;
    }
  }

  if (compare) {
    ctx.fillStyle = "#d4a017";
    ctx.font = "500 13px Inter, system-ui, sans-serif";
    ctx.fillText("A/B compare", PAD, cursorY);
    cursorY += 18;
    ctx.fillStyle = "#c5cad0";
    ctx.font = "400 12px Inter, system-ui, sans-serif";
    ctx.fillText(compare.summary.sentence, PAD, cursorY);
    cursorY += 28;
  }

  // Footer
  const fy = H - PAD - 28;
  ctx.strokeStyle = "#2a2f36";
  ctx.beginPath();
  ctx.moveTo(PAD, fy - 16);
  ctx.lineTo(W - PAD, fy - 16);
  ctx.stroke();

  ctx.fillStyle = "#8b929a";
  ctx.font = "400 11px Inter, system-ui, sans-serif";
  ctx.fillText(
    "Built by Neer Vasa · Monash MIT · scintilla.world · github.com/neervasa00000000",
    PAD,
    fy
  );
  ctx.fillStyle = "#5c6570";
  ctx.font = "400 10px Inter, system-ui, sans-serif";
  ctx.fillText(
    "Heuristic research instrument — not a formal WCAG audit or certification.",
    PAD,
    fy + 16
  );

  void rgbCss;
  void rgbHex;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Export failed"))),
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
