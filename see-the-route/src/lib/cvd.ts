/**
 * Colour vision deficiency (CVD) simulation.
 *
 * Model: Machado, Oliveira & Fernandes (2009) — linear-RGB 3×3 transforms
 * at severity 1.0 (dichromacy), applied in linear light after sRGB decode.
 * See: https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
 *
 * Low vision: mild separable Gaussian blur + contrast compression toward mid-grey.
 */

export type SimulationKind =
  | "normal"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "lowVision";

export const SIMULATION_LABELS: Record<SimulationKind, string> = {
  normal: "Normal",
  protanopia: "Protanopia",
  deuteranopia: "Deuteranopia",
  tritanopia: "Tritanopia",
  lowVision: "Low vision",
};

export const SIMULATION_ORDER: SimulationKind[] = [
  "normal",
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "lowVision",
];

/** Machado et al. 2009 — severity 1.0 matrices (linear RGB). */
const MACHADO: Record<
  "protanopia" | "deuteranopia" | "tritanopia",
  number[][]
> = {
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

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const x = Math.max(0, Math.min(1, c));
  const encoded =
    x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, encoded * 255)));
}

function applyMatrix(
  r: number,
  g: number,
  b: number,
  m: number[][]
): [number, number, number] {
  return [
    m[0][0] * r + m[0][1] * g + m[0][2] * b,
    m[1][0] * r + m[1][1] * g + m[1][2] * b,
    m[2][0] * r + m[2][1] * g + m[2][2] * b,
  ];
}

function simulatePixel(
  r: number,
  g: number,
  b: number,
  kind: Exclude<SimulationKind, "normal" | "lowVision">
): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const [nr, ng, nb] = applyMatrix(lr, lg, lb, MACHADO[kind]);
  return [linearToSrgb(nr), linearToSrgb(ng), linearToSrgb(nb)];
}

/** Separable box approximation of Gaussian blur (radius in px). */
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

  // Horizontal
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

  // Vertical
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

function reduceContrast(data: Uint8ClampedArray, amount = 0.45): void {
  // amount: 0 = no change, 1 = full mid-grey
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] * (1 - amount) + 128 * amount);
    data[i + 1] = Math.round(data[i + 1] * (1 - amount) + 128 * amount);
    data[i + 2] = Math.round(data[i + 2] * (1 - amount) + 128 * amount);
  }
}

export function processImageData(
  source: ImageData,
  kind: SimulationKind
): ImageData {
  const { width, height, data } = source;
  const out = new ImageData(width, height);

  if (kind === "normal") {
    out.data.set(data);
    return out;
  }

  if (kind === "lowVision") {
    const blurred = boxBlur(data, width, height, 2);
    // second pass for softer Gaussian-ish feel
    const soft = boxBlur(blurred, width, height, 1);
    reduceContrast(soft, 0.42);
    out.data.set(soft);
    return out;
  }

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = simulatePixel(data[i], data[i + 1], data[i + 2], kind);
    out.data[i] = r;
    out.data[i + 1] = g;
    out.data[i + 2] = b;
    out.data[i + 3] = data[i + 3];
  }
  return out;
}

/** Downscale for fast heuristics / preview processing. */
export function downscaleImageData(
  source: ImageData,
  maxEdge = 640
): ImageData {
  const { width, height } = source;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  if (scale >= 0.999) return source;

  const tw = Math.max(1, Math.round(width * scale));
  const th = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.putImageData(source, 0, 0);

  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  const octx = out.getContext("2d", { willReadFrequently: true })!;
  octx.drawImage(canvas, 0, 0, tw, th);
  return octx.getImageData(0, 0, tw, th);
}

export function imageDataToObjectUrl(imageData: ImageData): string {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext("2d")!.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

export async function loadImageFile(file: File | Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadImageUrl(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
  return img;
}

export function imageToImageData(img: HTMLImageElement): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
