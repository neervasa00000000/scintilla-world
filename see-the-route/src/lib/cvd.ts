/**
 * Machado, Oliveira & Fernandes (2009) CVD simulation.
 * Linear-RGB 3×3 at severity 1.0 (dichromacy), after sRGB decode.
 */

import { linearToRgb, rgbToLinear } from "./color";
import type { CvdMode, LowVisionSettings, Rgb } from "./types";

const MACHADO: Record<Exclude<CvdMode, "normal">, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function mul(m: number[][], v: [number, number, number]): [number, number, number] {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function simulateRgb(rgb: Rgb, mode: CvdMode): Rgb {
  if (mode === "normal") return { ...rgb };
  const lin = rgbToLinear(rgb);
  return linearToRgb(mul(MACHADO[mode], lin));
}

export function simulateImageData(
  source: ImageData,
  mode: CvdMode
): ImageData {
  const out = new ImageData(source.width, source.height);
  const s = source.data;
  const d = out.data;
  if (mode === "normal") {
    d.set(s);
    return out;
  }
  const m = MACHADO[mode];
  for (let i = 0; i < s.length; i += 4) {
    const rgb = simulateRgb({ r: s[i], g: s[i + 1], b: s[i + 2] }, mode);
    // use precomputed path via matrix on linear — already in simulateRgb
    void m;
    d[i] = rgb.r;
    d[i + 1] = rgb.g;
    d[i + 2] = rgb.b;
    d[i + 3] = s[i + 3];
  }
  return out;
}

function boxBlur(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number
): Uint8ClampedArray {
  if (radius < 1) return new Uint8ClampedArray(src);
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  const diam = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        const i = (y * w + xx) * 4;
        r += src[i];
        g += src[i + 1];
        b += src[i + 2];
        a += src[i + 3];
      }
      const o = (y * w + x) * 4;
      tmp[o] = r / diam;
      tmp[o + 1] = g / diam;
      tmp[o + 2] = b / diam;
      tmp[o + 3] = a / diam;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        const i = (yy * w + x) * 4;
        r += tmp[i];
        g += tmp[i + 1];
        b += tmp[i + 2];
        a += tmp[i + 3];
      }
      const o = (y * w + x) * 4;
      out[o] = r / diam;
      out[o + 1] = g / diam;
      out[o + 2] = b / diam;
      out[o + 3] = a / diam;
    }
  }
  return out;
}

/** Optional low-vision pass — never mixed into CVD findings. */
export function applyLowVision(
  source: ImageData,
  settings: LowVisionSettings
): ImageData {
  const radius = Math.max(0, Math.round(settings.blurSigma));
  let data = boxBlur(source.data, source.width, source.height, radius);
  if (radius >= 2) {
    data = boxBlur(data, source.width, source.height, Math.floor(radius / 2));
  }
  const amount = 1 - Math.max(0, Math.min(1, settings.contrast));
  const out = new ImageData(source.width, source.height);
  for (let i = 0; i < data.length; i += 4) {
    out.data[i] = Math.round(data[i] * (1 - amount) + 128 * amount);
    out.data[i + 1] = Math.round(data[i + 1] * (1 - amount) + 128 * amount);
    out.data[i + 2] = Math.round(data[i + 2] * (1 - amount) + 128 * amount);
    out.data[i + 3] = data[i + 3];
  }
  return out;
}

export function imageDataToUrl(imageData: ImageData): string {
  const c = document.createElement("canvas");
  c.width = imageData.width;
  c.height = imageData.height;
  c.getContext("2d")!.putImageData(imageData, 0, 0);
  return c.toDataURL("image/png");
}

export function downscale(source: ImageData, maxEdge = 800): ImageData {
  const { width, height } = source;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  if (scale >= 0.999) return source;
  const tw = Math.max(1, Math.round(width * scale));
  const th = Math.max(1, Math.round(height * scale));
  const src = document.createElement("canvas");
  src.width = width;
  src.height = height;
  src.getContext("2d")!.putImageData(source, 0, 0);
  const dst = document.createElement("canvas");
  dst.width = tw;
  dst.height = th;
  const ctx = dst.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, tw, th);
  return ctx.getImageData(0, 0, tw, th);
}

export async function loadFile(file: File | Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Failed to decode image"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadUrl(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error(`Failed to load ${src}`));
    img.src = src;
  });
  return img;
}

export function toImageData(img: HTMLImageElement): ImageData {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

export function sampleRgb(data: ImageData, x: number, y: number): Rgb {
  const xx = Math.min(data.width - 1, Math.max(0, Math.round(x)));
  const yy = Math.min(data.height - 1, Math.max(0, Math.round(y)));
  const i = (yy * data.width + xx) * 4;
  return { r: data.data[i], g: data.data[i + 1], b: data.data[i + 2] };
}

/** Average colour in a small window for stabler eyedropper. */
export function sampleRgbWindow(
  data: ImageData,
  x: number,
  y: number,
  radius = 2
): Rgb {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const xx = Math.min(data.width - 1, Math.max(0, Math.round(x) + dx));
      const yy = Math.min(data.height - 1, Math.max(0, Math.round(y) + dy));
      const i = (yy * data.width + xx) * 4;
      r += data.data[i];
      g += data.data[i + 1];
      b += data.data[i + 2];
      n++;
    }
  }
  return {
    r: Math.round(r / n),
    g: Math.round(g / n),
    b: Math.round(b / n),
  };
}
