/**
 * Generate map-like sample PNGs (no external deps).
 * Run: node scripts/generate-samples.mjs
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "samples");
fs.mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function writePng(filePath, width, height, rgbaFn) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a = 255] = rgbaFn(x, y, width, height);
      const i = rowStart + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, png);
}

function fillRect(set, x0, y0, x1, y1, color) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) set(x, y, color);
  }
}

function strokePoly(set, points, color, width = 4) {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const steps = Math.hypot(x1 - x0, y1 - y0);
    for (let t = 0; t <= steps; t++) {
      const x = Math.round(x0 + ((x1 - x0) * t) / steps);
      const y = Math.round(y0 + ((y1 - y0) * t) / steps);
      for (let dy = -width; dy <= width; dy++) {
        for (let dx = -width; dx <= width; dx++) {
          if (dx * dx + dy * dy <= width * width) set(x + dx, y + dy, color);
        }
      }
    }
  }
}

function makeCanvas(w, h, paint) {
  const buf = new Uint8ClampedArray(w * h * 4);
  const set = (x, y, [r, g, b, a = 255]) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    buf[i + 3] = a;
  };
  // base map grey-green
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = ((x * 17 + y * 31) % 40) - 20;
      set(x, y, [210 + n / 4, 220 + n / 5, 214 + n / 6]);
    }
  }
  paint(set, w, h);
  return (x, y) => {
    const i = (y * w + x) * 4;
    return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
  };
}

// 1) Transit map with red/green/blue lines + legend chips
{
  const w = 960;
  const h = 640;
  const rgba = makeCanvas(w, h, (set, W, H) => {
    // parks
    fillRect(set, 80, 100, 260, 280, [140, 198, 120]);
    fillRect(set, 620, 320, 860, 520, [150, 205, 130]);
    // water
    fillRect(set, 300, 40, 520, 200, [90, 160, 210]);
    // roads
    for (let y = 80; y < H; y += 90) {
      fillRect(set, 0, y, W, y + 10, [245, 245, 240]);
    }
    for (let x = 60; x < W; x += 110) {
      fillRect(set, x, 0, x + 8, H, [245, 245, 240]);
    }
    // transit lines — colour-only encoding
    strokePoly(
      set,
      [
        [40, 500],
        [220, 420],
        [400, 380],
        [580, 300],
        [820, 180],
      ],
      [220, 40, 40],
      5
    );
    strokePoly(
      set,
      [
        [60, 120],
        [200, 260],
        [360, 340],
        [540, 480],
        [900, 560],
      ],
      [40, 170, 70],
      5
    );
    strokePoly(
      set,
      [
        [100, 600],
        [300, 500],
        [480, 280],
        [700, 120],
      ],
      [40, 90, 210],
      5
    );
    // legend panel
    fillRect(set, 700, 40, 920, 190, [255, 255, 255]);
    fillRect(set, 720, 60, 760, 85, [220, 40, 40]);
    fillRect(set, 720, 100, 760, 125, [40, 170, 70]);
    fillRect(set, 720, 140, 760, 165, [40, 90, 210]);
  });
  writePng(path.join(outDir, "transit-map.png"), w, h, rgba);
}

// 2) Turn-by-turn nav with green "go" and red traffic
{
  const w = 720;
  const h = 960;
  const rgba = makeCanvas(w, h, (set, W, H) => {
    fillRect(set, 0, 0, W, H, [30, 34, 42]);
    // map area
    fillRect(set, 0, 0, W, 620, [200, 208, 198]);
    for (let y = 40; y < 600; y += 70) fillRect(set, 0, y, W, y + 14, [235, 235, 230]);
    for (let x = 40; x < W; x += 90) fillRect(set, x, 0, x + 12, 620, [235, 235, 230]);
    strokePoly(
      set,
      [
        [80, 560],
        [200, 400],
        [320, 320],
        [480, 200],
        [600, 80],
      ],
      [50, 200, 90],
      7
    );
    // traffic jam red overlay on same corridor
    strokePoly(
      set,
      [
        [200, 400],
        [280, 360],
        [320, 320],
      ],
      [230, 50, 50],
      7
    );
    // banner
    fillRect(set, 0, 620, W, H, [18, 20, 26]);
    fillRect(set, 40, 680, 200, 720, [50, 200, 90]);
    fillRect(set, 240, 680, 400, 720, [230, 50, 50]);
    fillRect(set, 440, 680, 600, 720, [255, 190, 40]);
  });
  writePng(path.join(outDir, "nav-route.png"), w, h, rgba);
}

// 3) Legend-heavy chips (many saturated colours)
{
  const w = 900;
  const h = 600;
  const rgba = makeCanvas(w, h, (set, W, H) => {
    fillRect(set, 0, 0, W, H, [245, 246, 248]);
    const colours = [
      [220, 40, 40],
      [40, 170, 70],
      [40, 90, 210],
      [240, 160, 30],
      [180, 60, 180],
      [30, 180, 180],
      [200, 80, 40],
      [80, 160, 40],
    ];
    colours.forEach((c, i) => {
      const x = 60 + (i % 4) * 200;
      const y = 80 + Math.floor(i / 4) * 200;
      fillRect(set, x, y, x + 120, y + 120, c);
      strokePoly(
        set,
        [
          [x + 20, y + 140 + i * 8],
          [x + 180, y + 80],
          [x + 320, y + 160],
        ],
        c,
        4
      );
    });
  });
  writePng(path.join(outDir, "legend-heavy.png"), w, h, rgba);
}

console.log("Wrote samples to", outDir);
