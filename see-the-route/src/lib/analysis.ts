/**
 * High-chroma colour cluster extraction with bounding boxes.
 * Quantizes saturated pixels into hue/chroma buckets, merges nearby blobs.
 */

import { chroma, colourNameHint, rgbToLab } from "./color";
import type { BBox, ColourCluster, Rgb } from "./types";

interface Bucket {
  r: number;
  g: number;
  b: number;
  n: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  key: string;
}

function quantKey(rgb: Rgb): string {
  // Coarse Lab-ish buckets via RGB for speed; prefer chroma-aware grouping
  const [L, a, b] = rgbToLab(rgb);
  const lQ = Math.round(L / 12);
  const aQ = Math.round(a / 14);
  const bQ = Math.round(b / 14);
  return `${lQ}:${aQ}:${bQ}`;
}

export function extractClusters(
  imageData: ImageData,
  opts?: { step?: number; minChroma?: number; minPixels?: number; maxClusters?: number }
): ColourCluster[] {
  const step = opts?.step ?? 3;
  const minChroma = opts?.minChroma ?? 0.28;
  const minPixels = opts?.minPixels ?? 18;
  const maxClusters = opts?.maxClusters ?? 14;
  const { width, height, data } = imageData;
  const buckets = new Map<string, Bucket>();

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 200) continue;
      const rgb = { r: data[i], g: data[i + 1], b: data[i + 2] };
      if (chroma(rgb) < minChroma) continue;
      // skip near-white / near-black even if somehow chromed
      const maxc = Math.max(rgb.r, rgb.g, rgb.b);
      const minc = Math.min(rgb.r, rgb.g, rgb.b);
      if (maxc < 40 || minc > 245) continue;

      const key = quantKey(rgb);
      const b = buckets.get(key);
      if (!b) {
        buckets.set(key, {
          key,
          r: rgb.r,
          g: rgb.g,
          b: rgb.b,
          n: 1,
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
        });
      } else {
        b.r += rgb.r;
        b.g += rgb.g;
        b.b += rgb.b;
        b.n += 1;
        b.minX = Math.min(b.minX, x);
        b.minY = Math.min(b.minY, y);
        b.maxX = Math.max(b.maxX, x);
        b.maxY = Math.max(b.maxY, y);
      }
    }
  }

  const raw: ColourCluster[] = [];
  let idx = 0;
  for (const b of buckets.values()) {
    if (b.n < minPixels) continue;
    const mean: Rgb = {
      r: Math.round(b.r / b.n),
      g: Math.round(b.g / b.n),
      b: Math.round(b.b / b.n),
    };
    const pad = 4;
    const bbox: BBox = {
      x: Math.max(0, b.minX - pad),
      y: Math.max(0, b.minY - pad),
      w: Math.min(width - 1, b.maxX + pad) - Math.max(0, b.minX - pad),
      h: Math.min(height - 1, b.maxY + pad) - Math.max(0, b.minY - pad),
    };
    // Prefer compact markers/chips over huge washes
    const area = bbox.w * bbox.h;
    const density = b.n / Math.max(1, area / (step * step));
    if (area > width * height * 0.35 && density < 0.15) continue;

    const name = colourNameHint(mean);
    raw.push({
      id: `c${idx++}`,
      label: `${name} region`,
      mean,
      bbox,
      pixelCount: b.n,
      chroma: chroma(mean),
    });
  }

  // Prefer smaller, more saturated, denser clusters (pins / legend chips / lines)
  raw.sort((a, b) => {
    const sa =
      a.chroma * 2 +
      Math.min(1, 400 / (a.bbox.w * a.bbox.h + 1)) +
      Math.min(1, a.pixelCount / 80);
    const sb =
      b.chroma * 2 +
      Math.min(1, 400 / (b.bbox.w * b.bbox.h + 1)) +
      Math.min(1, b.pixelCount / 80);
    return sb - sa;
  });

  const selected = raw.slice(0, maxClusters);

  // Relabel with ordinal by colour family for specificity
  const counts = new Map<string, number>();
  for (const c of selected) {
    const base = colourNameHint(c.mean);
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    c.label = n > 1 ? `${base} #${n}` : `${base} marker`;
  }
  return selected;
}

export function unionBBox(a: BBox, b: BBox): BBox {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.w, b.x + b.w);
  const y2 = Math.max(a.y + a.h, b.y + b.h);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}
