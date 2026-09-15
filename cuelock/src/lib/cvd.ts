/**
 * Machado, Oliveira & Fernandes (2009) CVD simulation — severity 1.0 matrices.
 */

import { linearToRgb, parseHex, rgbToHex, rgbToLinear, type Rgb } from "./color";
import type { CvdMode } from "./types";

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
  return linearToRgb(mul(MACHADO[mode], rgbToLinear(rgb)));
}

export function simulateHex(hex: string, mode: CvdMode): string {
  return rgbToHex(simulateRgb(parseHex(hex), mode));
}
