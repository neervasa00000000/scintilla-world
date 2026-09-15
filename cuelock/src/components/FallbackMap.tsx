"use client";

/**
 * Melbourne demo map — SVG routes/pins bound to cues[] state.
 * Coordinates are auto-fit into the viewBox so nothing renders off-screen.
 */

import {
  ACTIVE_ROUTE,
  ALT_ROUTE,
  DESTINATION_POINT,
  HAZARD_POINT,
  ORIGIN_POINT,
} from "@/lib/demo";
import type { Cue } from "@/lib/types";

type Props = {
  cues: Cue[];
  failingIds: Set<string>;
  callouts?: string[];
};

const W = 640;
const H = 520;
const PAD = 48;

const ALL_POINTS: [number, number][] = [
  ...ACTIVE_ROUTE,
  ...ALT_ROUTE,
  HAZARD_POINT,
  DESTINATION_POINT,
  ORIGIN_POINT,
];

function buildProjector(points: [number, number][]) {
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of points) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  // pad geographic extent slightly
  const dLng = Math.max(maxLng - minLng, 0.002);
  const dLat = Math.max(maxLat - minLat, 0.002);
  minLng -= dLng * 0.15;
  maxLng += dLng * 0.15;
  minLat -= dLat * 0.15;
  maxLat += dLat * 0.15;

  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2 - 20; // leave room for title
  const sx = innerW / (maxLng - minLng);
  const sy = innerH / (maxLat - minLat);
  const s = Math.min(sx, sy);

  const usedW = (maxLng - minLng) * s;
  const usedH = (maxLat - minLat) * s;
  const ox = PAD + (innerW - usedW) / 2;
  const oy = PAD + 20 + (innerH - usedH) / 2;

  return (lng: number, lat: number): [number, number] => {
    const x = ox + (lng - minLng) * s;
    // SVG y grows downward; north (higher lat) should be higher on screen → smaller y
    const y = oy + (maxLat - lat) * s;
    return [x, y];
  };
}

const project = buildProjector(ALL_POINTS);

function linePath(coords: [number, number][]): string {
  return coords
    .map((c, i) => {
      const [x, y] = project(c[0], c[1]);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function FallbackMap({ cues, failingIds, callouts = [] }: Props) {
  const byRole = (role: string) => cues.find((c) => c.role === role);
  const active = byRole("route_active");
  const alt = byRole("route_alt");
  const hazard = byRole("hazard");
  const dest = byRole("destination");

  const activeW = Math.max(active?.secondaryEncoding.width ?? 5, 5);
  const altW = Math.max(alt?.secondaryEncoding.width ?? 5, 5);
  const activeDash =
    active?.secondaryEncoding.pattern === "dashed" ? "12 8" : undefined;
  const altDash =
    alt?.secondaryEncoding.pattern === "dashed" ? "14 10" : undefined;

  const [ox, oy] = project(ORIGIN_POINT[0], ORIGIN_POINT[1]);
  const [hx, hy] = project(HAZARD_POINT[0], HAZARD_POINT[1]);
  const [dx, dy] = project(DESTINATION_POINT[0], DESTINATION_POINT[1]);

  return (
    <div className="relative h-full min-h-[360px] w-full overflow-hidden bg-[#1a1e24]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Melbourne demo route map"
      >
        <defs>
          <pattern
            id="cuelock-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="#2a3038"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="#1a1e24" />
        <rect width={W} height={H} fill="url(#cuelock-grid)" />

        {/* soft street blocks for context */}
        <rect
          x={80}
          y={100}
          width={180}
          height={120}
          fill="#222830"
          opacity={0.6}
          rx={4}
        />
        <rect
          x={360}
          y={200}
          width={160}
          height={140}
          fill="#222830"
          opacity={0.5}
          rx={4}
        />

        <text
          x={16}
          y={28}
          fill="#8b929a"
          fontSize="12"
          fontFamily="system-ui, sans-serif"
        >
          Melbourne CBD · Flinders St → Melbourne Central
        </text>

        {/* Backup route (under) */}
        {alt && (
          <path
            d={linePath(ALT_ROUTE)}
            fill="none"
            stroke={alt.colour}
            strokeWidth={altW}
            strokeDasharray={altDash}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.95}
          />
        )}

        {/* Main route */}
        {active && (
          <path
            d={linePath(ACTIVE_ROUTE)}
            fill="none"
            stroke={active.colour}
            strokeWidth={activeW}
            strokeDasharray={activeDash}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Start pin */}
        <circle
          cx={ox}
          cy={oy}
          r={7}
          fill="#111827"
          stroke="#e8eaed"
          strokeWidth={2}
        />
        <text
          x={ox + 12}
          y={oy + 4}
          fill="#c5cad0"
          fontSize="12"
          fontFamily="system-ui, sans-serif"
          fontWeight={500}
        >
          Start
        </text>

        {/* Hazard */}
        {hazard && (
          <g>
            {hazard.secondaryEncoding.icon === "triangle" ? (
              <polygon
                points={`${hx},${hy - 12} ${hx - 11},${hy + 10} ${hx + 11},${hy + 10}`}
                fill={hazard.colour}
                stroke={failingIds.has(hazard.id) ? "#ff6b6b" : "#0f1113"}
                strokeWidth={2}
              />
            ) : (
              <circle
                cx={hx}
                cy={hy}
                r={9}
                fill={hazard.colour}
                stroke={failingIds.has(hazard.id) ? "#ff6b6b" : "#0f1113"}
                strokeWidth={2}
              />
            )}
            <text
              x={hx + 14}
              y={hy + 4}
              fill="#e8eaed"
              fontSize="12"
              fontFamily="system-ui, sans-serif"
              fontWeight={500}
            >
              Hazard
            </text>
          </g>
        )}

        {/* Destination */}
        {dest && (
          <g>
            <circle
              cx={dx}
              cy={dy}
              r={9}
              fill={dest.colour}
              stroke="#0f1113"
              strokeWidth={2}
            />
            <text
              x={dx + 14}
              y={dy + 4}
              fill="#e8eaed"
              fontSize="12"
              fontFamily="system-ui, sans-serif"
              fontWeight={500}
            >
              Destination
            </text>
          </g>
        )}

        {/* Legend */}
        <g transform="translate(16, 470)">
          <rect
            width="280"
            height="36"
            rx="4"
            fill="#12161c"
            stroke="#2a2f36"
          />
          <line
            x1="12"
            y1="18"
            x2="40"
            y2="18"
            stroke={active?.colour ?? "#22c55e"}
            strokeWidth={4}
            strokeDasharray={activeDash}
          />
          <text x="48" y="22" fill="#8b929a" fontSize="11" fontFamily="system-ui">
            Main
          </text>
          <line
            x1="100"
            y1="18"
            x2="128"
            y2="18"
            stroke={alt?.colour ?? "#ef4444"}
            strokeWidth={4}
            strokeDasharray={altDash ?? (alt?.secondaryEncoding.pattern === "dashed" ? "8 6" : undefined)}
          />
          <text x="136" y="22" fill="#8b929a" fontSize="11" fontFamily="system-ui">
            Backup{alt?.secondaryEncoding.pattern === "dashed" ? " (dashed)" : ""}
          </text>
        </g>
      </svg>

      {callouts.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-10 z-10 flex max-w-[260px] flex-col gap-1.5">
          {callouts.slice(0, 2).map((c) => (
            <div
              key={c}
              className="rounded border border-[#c45c5c]/50 bg-[#c45c5c]/90 px-2.5 py-1.5 text-[12px] font-medium text-white shadow"
            >
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
