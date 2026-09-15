/**
 * Colour science: sRGB ↔ Lab, CIEDE2000 (Sharma, Wu & Dalal 2005).
 */

export type Rgb = { r: number; g: number; b: number };

export function parseHex(hex: string): Rgb {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return { r: 128, g: 128, b: 128 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(rgb: Rgb): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c: number): number {
  const x = Math.max(0, Math.min(1, c));
  const enc =
    x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(255, enc * 255)));
}

export function rgbToLinear(rgb: Rgb): [number, number, number] {
  return [srgbToLinear(rgb.r), srgbToLinear(rgb.g), srgbToLinear(rgb.b)];
}

export function linearToRgb(l: [number, number, number]): Rgb {
  return {
    r: linearToSrgb(l[0]),
    g: linearToSrgb(l[1]),
    b: linearToSrgb(l[2]),
  };
}

function rgbToXyz(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgbToLinear(rgb);
  return [
    r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
    r * 0.2126729 + g * 0.7151522 + b * 0.072175,
    r * 0.0193339 + g * 0.119192 + b * 0.9503041,
  ];
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const xr = x / 0.95047;
  const yr = y / 1.0;
  const zr = z / 1.08883;
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29;
  const fx = f(xr);
  const fy = f(yr);
  const fz = f(zr);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function rgbToLab(rgb: Rgb): [number, number, number] {
  const [x, y, z] = rgbToXyz(rgb);
  return xyzToLab(x, y, z);
}

/** CIEDE2000 colour difference. */
export function deltaE2000(a: Rgb, b: Rgb): number {
  const [L1, a1, b1] = rgbToLab(a);
  const [L2, a2, b2] = rgbToLab(b);
  const kL = 1,
    kC = 1,
    kH = 1;
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);
  const h1p =
    b1 === 0 && a1p === 0 ? 0 : (Math.atan2(b1, a1p) * 180) / Math.PI;
  const h2p =
    b2 === 0 && a2p === 0 ? 0 : (Math.atan2(b2, a2p) * 180) / Math.PI;
  const H1p = h1p >= 0 ? h1p : h1p + 360;
  const H2p = h2p >= 0 ? h2p : h2p + 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    if (Math.abs(H2p - H1p) <= 180) dhp = H2p - H1p;
    else if (H2p - H1p > 180) dhp = H2p - H1p - 360;
    else dhp = H2p - H1p + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI) / 360);
  const Lbar = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let Hbarp = H1p + H2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(H1p - H2p) <= 180) Hbarp = (H1p + H2p) / 2;
    else if (H1p + H2p < 360) Hbarp = (H1p + H2p + 360) / 2;
    else Hbarp = (H1p + H2p - 360) / 2;
  }
  const T =
    1 -
    0.17 * Math.cos(((Hbarp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * Hbarp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * Hbarp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * Hbarp - 63) * Math.PI) / 180);
  const dRo = 30 * Math.exp(-Math.pow((Hbarp - 275) / 25, 2));
  const RC = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)));
  const SL =
    1 +
    (0.015 * Math.pow(Lbar - 50, 2)) /
      Math.sqrt(20 + Math.pow(Lbar - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin((2 * dRo * Math.PI) / 180) * RC;
  return Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
      Math.pow(dCp / (kC * SC), 2) +
      Math.pow(dHp / (kH * SH), 2) +
      RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  );
}
