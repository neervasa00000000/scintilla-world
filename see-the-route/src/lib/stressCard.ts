import type { FailureFlag } from "./heuristics";
import { SIMULATION_LABELS, type SimulationKind } from "./cvd";

export interface StressCardInput {
  panels: Partial<Record<SimulationKind, string>>; // data URLs
  flags: FailureFlag[];
  sourceName?: string;
}

const PANEL_KEYS: SimulationKind[] = [
  "normal",
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "lowVision",
];

function loadDataUrl(url: string): Promise<HTMLImageElement> {
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

export async function exportStressCard(
  input: StressCardInput
): Promise<Blob> {
  const W = 1600;
  const PAD = 56;
  const cols = 3;
  const gap = 20;
  const gridW = W - PAD * 2;
  const cellW = (gridW - gap * (cols - 1)) / cols;
  const cellH = cellW * 0.72;
  const rows = 2;
  const gridH = cellH * rows + gap * (rows - 1);

  const topBlock = 150;
  const failBlock = 220;
  const footerH = 72;
  const H = PAD + topBlock + gridH + 36 + failBlock + footerH + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0a0b0f");
  bg.addColorStop(0.5, "#0d1118");
  bg.addColorStop(1, "#0a0c12");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Accent bar
  ctx.fillStyle = "#3dffa8";
  ctx.fillRect(PAD, PAD, 48, 4);

  ctx.fillStyle = "#f4f6f8";
  ctx.font = "600 36px ui-sans-serif, system-ui, -apple-system, sans-serif";
  ctx.fillText("See-the-Route · Accessibility Stress Card", PAD, PAD + 48);

  ctx.fillStyle = "#8b93a7";
  ctx.font = "400 18px ui-sans-serif, system-ui, -apple-system, sans-serif";
  ctx.fillText(
    "Map/route UI under colour vision deficiency & low vision",
    PAD,
    PAD + 80
  );

  if (input.sourceName) {
    ctx.fillStyle = "#5c6578";
    ctx.font = "400 14px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`Source: ${input.sourceName}`, PAD, PAD + 108);
  }

  // Panels
  const startY = PAD + topBlock;
  const images = await Promise.all(
    PANEL_KEYS.map(async (k) => {
      const url = input.panels[k];
      if (!url) return null;
      try {
        return { kind: k, img: await loadDataUrl(url) };
      } catch {
        return null;
      }
    })
  );

  for (let i = 0; i < PANEL_KEYS.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PAD + col * (cellW + gap);
    const y = startY + row * (cellH + gap);

    roundRect(ctx, x, y, cellW, cellH, 12);
    ctx.fillStyle = "#141820";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();

    const entry = images[i];
    if (entry) {
      const { img } = entry;
      const labelH = 28;
      const iw = cellW - 16;
      const ih = cellH - 16 - labelH;
      const scale = Math.min(iw / img.width, ih / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = x + 8 + (iw - dw) / 2;
      const dy = y + 8 + (ih - dh) / 2;
      ctx.save();
      roundRect(ctx, x + 6, y + 6, cellW - 12, cellH - 12 - labelH, 8);
      ctx.clip();
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();

      ctx.fillStyle = "#c5cad6";
      ctx.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(SIMULATION_LABELS[entry.kind], x + 14, y + cellH - 12);
    } else {
      ctx.fillStyle = "#5c6578";
      ctx.font = "14px sans-serif";
      ctx.fillText(SIMULATION_LABELS[PANEL_KEYS[i]], x + 16, y + 28);
    }
  }

  // Failures
  const failY = startY + gridH + 36;
  ctx.fillStyle = "#f4f6f8";
  ctx.font = "600 20px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("Failures / Risks (heuristic)", PAD, failY);

  const topFlags = input.flags.slice(0, 5);
  let fy = failY + 28;
  for (const f of topFlags) {
    const color =
      f.severity === "High"
        ? "#ff6b6b"
        : f.severity === "Medium"
          ? "#ffb020"
          : "#6bcb8b";
    roundRect(ctx, PAD, fy, 64, 22, 4);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "#0a0b0f";
    ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(f.severity.toUpperCase(), PAD + 8, fy + 15);

    ctx.fillStyle = "#e8ebf0";
    ctx.font = "500 15px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(f.title, PAD + 78, fy + 16);
    fy += 34;
  }

  // Footer
  const footerY = H - PAD - 28;
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(PAD, footerY - 24, gridW, 1);

  ctx.fillStyle = "#8b93a7";
  ctx.font = "400 13px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(
    "Built by Neer Vasa · Monash MIT · scintilla.world · github.com/neervasa00000000",
    PAD,
    footerY
  );
  ctx.fillStyle = "#5c6578";
  ctx.font = "400 11px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(
    "Heuristic flags for research demos — not a WCAG audit. CVD: Machado et al. 2009.",
    PAD,
    footerY + 20
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
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
