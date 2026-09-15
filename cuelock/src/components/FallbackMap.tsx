"use client";

/**
 * Always-works Melbourne demo map (SVG). Used when MapLibre chunk fails
 * or while we prefer reliability over tiles. Reads the same cues[] state.
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

/** Rough Web Mercator-ish project around Melbourne CBD for SVG viewBox. */
function project(lng: number, lat: number): [number, number] {
  const lng0 = 144.958;
  const lat0 = -37.822;
  const scale = 52000;
  const x = (lng - lng0) * scale;
  const y = (lat0 - lat) * scale;
  return [x, y];
}

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

  const activeDash =
    active?.secondaryEncoding.pattern === "dashed" ? "8 6" : undefined;
  const altDash =
    alt?.secondaryEncoding.pattern === "dashed" ? "10 8" : undefined;

  const [ox, oy] = project(ORIGIN_POINT[0], ORIGIN_POINT[1]);
  const [hx, hy] = project(HAZARD_POINT[0], HAZARD_POINT[1]);
  const [dx, dy] = project(DESTINATION_POINT[0], DESTINATION_POINT[1]);

  return (
    <div className="relative h-full min-h-[360px] w-full overflow-hidden bg-[#1a1e24]">
      {/* fake street grid */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 640 520"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="#2a3038"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="640" height="520" fill="#1a1e24" />
        <rect width="640" height="520" fill="url(#grid)" />
        <text x="16" y="28" fill="#5c6570" fontSize="11" fontFamily="system-ui">
          Melbourne CBD · Flinders St → Melbourne Central
        </text>

        {/* Backup route under */}
        {alt && (
          <path
            d={linePath(ALT_ROUTE)}
            fill="none"
            stroke={alt.colour}
            strokeWidth={alt.secondaryEncoding.width ?? 4}
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
            strokeWidth={active.secondaryEncoding.width ?? 4}
            strokeDasharray={activeDash}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Start */}
        <circle cx={ox} cy={oy} r={6} fill="#111827" stroke="#e8eaed" strokeWidth={2} />
        <text x={ox + 10} y={oy + 4} fill="#c5cad0" fontSize="11" fontFamily="system-ui">
          Start
        </text>

        {/* Hazard */}
        {hazard && (
          <g>
            {hazard.secondaryEncoding.icon === "triangle" ? (
              <polygon
                points={`${hx},${hy - 10} ${hx - 9},${hy + 8} ${hx + 9},${hy + 8}`}
                fill={hazard.colour}
                stroke={failingIds.has(hazard.id) ? "#c45c5c" : "#0f1113"}
                strokeWidth={2}
              />
            ) : (
              <circle
                cx={hx}
                cy={hy}
                r={8}
                fill={hazard.colour}
                stroke={failingIds.has(hazard.id) ? "#c45c5c" : "#0f1113"}
                strokeWidth={2}
              />
            )}
            {(hazard.secondaryEncoding.labelOnMap || failingIds.has(hazard.id)) && (
              <text
                x={hx + 12}
                y={hy + 4}
                fill="#e8eaed"
                fontSize="11"
                fontFamily="system-ui"
              >
                Hazard
              </text>
            )}
          </g>
        )}

        {/* Destination */}
        {dest && (
          <g>
            <circle
              cx={dx}
              cy={dy}
              r={8}
              fill={dest.colour}
              stroke="#0f1113"
              strokeWidth={2}
            />
            {(dest.secondaryEncoding.labelOnMap || true) && (
              <text
                x={dx + 12}
                y={dy + 4}
                fill="#e8eaed"
                fontSize="11"
                fontFamily="system-ui"
              >
                Destination
              </text>
            )}
          </g>
        )}
      </svg>

      {callouts.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[260px] flex-col gap-1.5">
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
