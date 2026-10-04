"use client";

/**
 * Universal dynamic SVG map for CueLock.
 * Supports:
 * - Live CVD color simulation (Machado et al. 2009)
 * - Arbitrary routes (LineStrings) and marker points
 * - Line patterns (solid, dashed, dotted), stroke widths
 * - Marker shapes (circle, triangle, square, diamond)
 * - Map labels, fail indicators, and interactive cue selection
 * - Zoom & pan controls
 */

import { useMemo, useState } from "react";
import {
  ACTIVE_ROUTE,
  ALT_ROUTE,
  DESTINATION_POINT,
  HAZARD_POINT,
  ORIGIN_POINT,
} from "@/lib/demo";
import { simulateHex } from "@/lib/cvd";
import type { Cue, CvdMode } from "@/lib/types";

export type FallbackMapProps = {
  cues: Cue[];
  failingIds: Set<string>;
  callouts?: string[];
  cvdMode?: CvdMode;
  selectedCueId?: string | null;
  onSelectCue?: (cueId: string) => void;
  title?: string;
};

const W = 640;
const H = 520;
const PAD = 50;

type ProjectedPoint = [number, number];

export function FallbackMap({
  cues,
  failingIds,
  callouts = [],
  cvdMode = "normal",
  selectedCueId,
  onSelectCue,
  title,
}: FallbackMapProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Gather coordinates from cues or defaults
  const { allPoints, cueCoordinates } = useMemo(() => {
    const points: [number, number][] = [];
    const coordMap = new Map<string, [number, number][] | [number, number]>();

    let customLineOffset = 0;
    let customPointOffset = 0;

    cues.forEach((cue) => {
      if (cue.coordinates) {
        if (Array.isArray(cue.coordinates[0])) {
          const line = cue.coordinates as [number, number][];
          coordMap.set(cue.id, line);
          line.forEach((p) => points.push(p));
        } else {
          const pt = cue.coordinates as [number, number];
          coordMap.set(cue.id, pt);
          points.push(pt);
        }
        return;
      }

      // Geometry reference or role fallbacks
      if (cue.geometryRef === "route-active" || cue.role === "route_active") {
        coordMap.set(cue.id, ACTIVE_ROUTE);
        ACTIVE_ROUTE.forEach((p) => points.push(p));
      } else if (cue.geometryRef === "route-alt" || cue.role === "route_alt") {
        coordMap.set(cue.id, ALT_ROUTE);
        ALT_ROUTE.forEach((p) => points.push(p));
      } else if (cue.geometryRef === "hazard" || cue.role === "hazard") {
        coordMap.set(cue.id, HAZARD_POINT);
        points.push(HAZARD_POINT);
      } else if (cue.geometryRef === "destination" || cue.role === "destination") {
        coordMap.set(cue.id, DESTINATION_POINT);
        points.push(DESTINATION_POINT);
      } else if (cue.geometryRef === "origin") {
        coordMap.set(cue.id, ORIGIN_POINT);
        points.push(ORIGIN_POINT);
      } else {
        // Fallback schematic placement for custom cues without coordinates
        const isLine = cue.role === "mode_transit" || cue.role === "mode_walk" || (cue.secondaryEncoding.width ?? 0) > 0;
        if (isLine) {
          const dy = 0.002 * (customLineOffset + 1);
          customLineOffset++;
          const schematicLine: [number, number][] = [
            [144.9610, -37.8180 + dy],
            [144.9630, -37.8150 + dy],
            [144.9660, -37.8120 + dy],
            [144.9680, -37.8090 + dy],
          ];
          coordMap.set(cue.id, schematicLine);
          schematicLine.forEach((p) => points.push(p));
        } else {
          customPointOffset++;
          const schematicPoint: [number, number] = [
            144.9630 + (customPointOffset % 3) * 0.002,
            -37.8150 + Math.floor(customPointOffset / 3) * 0.002,
          ];
          coordMap.set(cue.id, schematicPoint);
          points.push(schematicPoint);
        }
      }
    });

    if (points.length === 0) {
      ACTIVE_ROUTE.forEach((p) => points.push(p));
      ALT_ROUTE.forEach((p) => points.push(p));
      points.push(HAZARD_POINT, DESTINATION_POINT, ORIGIN_POINT);
    }

    return { allPoints: points, cueCoordinates: coordMap };
  }, [cues]);

  // Projector from [lng, lat] -> SVG [x, y]
  const project = useMemo(() => {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    for (const [lng, lat] of allPoints) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }

    const dLng = Math.max(maxLng - minLng, 0.002);
    const dLat = Math.max(maxLat - minLat, 0.002);
    minLng -= dLng * 0.15;
    maxLng += dLng * 0.15;
    minLat -= dLat * 0.15;
    maxLat += dLat * 0.15;

    const innerW = W - PAD * 2;
    const innerH = H - PAD * 2 - 24;
    const sx = innerW / (maxLng - minLng);
    const sy = innerH / (maxLat - minLat);
    const s = Math.min(sx, sy) * zoom;

    const usedW = (maxLng - minLng) * s;
    const usedH = (maxLat - minLat) * s;
    const ox = PAD + (innerW - usedW) / 2 + pan.x;
    const oy = PAD + 24 + (innerH - usedH) / 2 + pan.y;

    return (lng: number, lat: number): ProjectedPoint => {
      const x = ox + (lng - minLng) * s;
      const y = oy + (maxLat - lat) * s;
      return [x, y];
    };
  }, [allPoints, zoom, pan]);

  function linePath(coords: [number, number][]): string {
    return coords
      .map((c, i) => {
        const [x, y] = project(c[0], c[1]);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  // Get simulated color for rendering
  function getDisplayColor(hex: string): string {
    if (!cvdMode || cvdMode === "normal") return hex;
    try {
      return simulateHex(hex, cvdMode);
    } catch {
      return hex;
    }
  }

  // Separate line cues and marker cues
  const lineCues = cues.filter((cue) => {
    const coords = cueCoordinates.get(cue.id);
    return Array.isArray(coords) && Array.isArray(coords[0]);
  });

  const markerCues = cues.filter((cue) => {
    const coords = cueCoordinates.get(cue.id);
    return Array.isArray(coords) && typeof coords[0] === "number";
  });

  // Default origin if present in Melbourne demo
  const hasOriginPoint = cues.some((c) => c.geometryRef === "route-active" || c.role === "route_active");
  const [ox, oy] = project(ORIGIN_POINT[0], ORIGIN_POINT[1]);

  return (
    <div className="relative h-full min-h-[440px] w-full overflow-hidden bg-[#161a1f] select-none">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="CueLock navigation map"
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
              stroke="#242b33"
              strokeWidth="1"
            />
          </pattern>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <rect width={W} height={H} fill="#14181d" />
        <rect width={W} height={H} fill="url(#cuelock-grid)" />

        {/* Schematic blocks */}
        <g opacity={0.45}>
          <rect x={75} y={105} width={180} height={120} fill="#202730" rx={6} />
          <rect x={355} y={195} width={160} height={140} fill="#202730" rx={6} />
          <rect x={280} y={80} width={110} height={85} fill="#1c222b" rx={4} />
          <rect x={120} y={280} width={140} height={95} fill="#1c222b" rx={4} />
        </g>

        {/* Map Header / Mode Notice */}
        <text
          x={16}
          y={26}
          fill="#8b959e"
          fontSize="12"
          fontFamily="system-ui, sans-serif"
          fontWeight={500}
        >
          {title ?? (cvdMode !== "normal" ? `Simulated vision: ${cvdMode}` : "Live map preview")}
        </text>

        {/* Render Route Lines */}
        {lineCues.map((cue) => {
          const coords = cueCoordinates.get(cue.id) as [number, number][];
          if (!coords || coords.length < 2) return null;

          const color = getDisplayColor(cue.colour);
          const width = Math.max(cue.secondaryEncoding.width ?? 5, 3);
          const pattern = cue.secondaryEncoding.pattern;
          const dashArray =
            pattern === "dashed"
              ? "13 8"
              : pattern === "dotted"
              ? "4 7"
              : undefined;

          const isFailing = failingIds.has(cue.id);
          const isSelected = selectedCueId === cue.id;

          return (
            <g
              key={cue.id}
              onClick={() => onSelectCue?.(cue.id)}
              className="cursor-pointer transition-opacity"
              opacity={selectedCueId && !isSelected ? 0.65 : 1}
            >
              {/* Highlight casing if selected or failing */}
              {(isSelected || isFailing) && (
                <path
                  d={linePath(coords)}
                  fill="none"
                  stroke={isFailing ? "#ff6b6b" : "#e6b452"}
                  strokeWidth={width + 5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.4}
                />
              )}
              <path
                d={linePath(coords)}
                fill="none"
                stroke={color}
                strokeWidth={width}
                strokeDasharray={dashArray}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.95}
              />
            </g>
          );
        })}

        {/* Start Pin for Melbourne demo */}
        {hasOriginPoint && (
          <g>
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
          </g>
        )}

        {/* Render Marker Points */}
        {markerCues.map((cue) => {
          const pt = cueCoordinates.get(cue.id) as [number, number];
          if (!pt) return null;

          const [x, y] = project(pt[0], pt[1]);
          const color = getDisplayColor(cue.colour);
          const isFailing = failingIds.has(cue.id);
          const isSelected = selectedCueId === cue.id;
          const shape = cue.secondaryEncoding.icon ?? "circle";

          return (
            <g
              key={cue.id}
              onClick={() => onSelectCue?.(cue.id)}
              className="cursor-pointer"
            >
              {/* Alert halo */}
              {isFailing && (
                <circle
                  cx={x}
                  cy={y}
                  r={18}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  opacity={0.65}
                  strokeDasharray="3 3"
                />
              )}

              {/* Marker Shape */}
              {shape === "triangle" ? (
                <polygon
                  points={`${x},${y - 12} ${x - 11},${y + 9} ${x + 11},${y + 9}`}
                  fill={color}
                  stroke={isSelected ? "#e6b452" : isFailing ? "#ff6b6b" : "#0f1113"}
                  strokeWidth={isSelected ? 3 : 2}
                />
              ) : shape === "square" ? (
                <rect
                  x={x - 9}
                  y={y - 9}
                  width={18}
                  height={18}
                  rx={3}
                  fill={color}
                  stroke={isSelected ? "#e6b452" : isFailing ? "#ff6b6b" : "#0f1113"}
                  strokeWidth={isSelected ? 3 : 2}
                />
              ) : shape === "diamond" ? (
                <polygon
                  points={`${x},${y - 12} ${x + 11},${y} ${x},${y + 12} ${x - 11},${y}`}
                  fill={color}
                  stroke={isSelected ? "#e6b452" : isFailing ? "#ff6b6b" : "#0f1113"}
                  strokeWidth={isSelected ? 3 : 2}
                />
              ) : (
                <circle
                  cx={x}
                  cy={y}
                  r={9}
                  fill={color}
                  stroke={isSelected ? "#e6b452" : isFailing ? "#ff6b6b" : "#0f1113"}
                  strokeWidth={isSelected ? 3 : 2}
                />
              )}

              {/* Label */}
              {cue.secondaryEncoding.labelOnMap && (
                <text
                  x={x + 14}
                  y={y + 4}
                  fill="#e8eaed"
                  fontSize="12"
                  fontFamily="system-ui, sans-serif"
                  fontWeight={600}
                >
                  {cue.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Live Legend */}
        <g transform="translate(16, 466)">
          <rect
            width={Math.min(W - 32, Math.max(260, cues.length * 115))}
            height="40"
            rx="6"
            fill="#12161b"
            stroke="#2b343d"
          />
          {cues.slice(0, 4).map((cue, idx) => {
            const color = getDisplayColor(cue.colour);
            const x = 12 + idx * 118;
            const isLine = (cue.secondaryEncoding.width ?? 0) > 0 || cue.role.includes("route");
            return (
              <g
                key={cue.id}
                onClick={() => onSelectCue?.(cue.id)}
                className="cursor-pointer"
              >
                {isLine ? (
                  <line
                    x1={x}
                    y1={20}
                    x2={x + 24}
                    y2={20}
                    stroke={color}
                    strokeWidth={4}
                    strokeDasharray={
                      cue.secondaryEncoding.pattern === "dashed"
                        ? "6 4"
                        : cue.secondaryEncoding.pattern === "dotted"
                        ? "3 3"
                        : undefined
                    }
                  />
                ) : (
                  <circle cx={x + 10} cy={20} r={5} fill={color} />
                )}
                <text
                  x={x + 28}
                  y={24}
                  fill="#9ba5ae"
                  fontSize="11"
                  fontFamily="system-ui"
                >
                  {cue.label.split(" ")[0]}
                  {cue.secondaryEncoding.pattern === "dashed" ? " (d)" : ""}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* CVD Simulation Indicator Badge */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-[#3b444d] bg-[#14181dc9] px-2.5 py-1 text-[11px] backdrop-blur">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: cvdMode === "normal" ? "#22c55e" : "#e6b452" }} />
        <span className="font-medium text-[#c5cad0]">
          {cvdMode === "normal"
            ? "Normal Vision"
            : cvdMode === "protanopia"
            ? "Protanopia (Red-Blind)"
            : cvdMode === "deuteranopia"
            ? "Deuteranopia (Green-Blind)"
            : "Tritanopia (Blue-Blind)"}
        </span>
      </div>

      {/* Map Zoom Controls */}
      <div className="absolute bottom-16 right-3 z-10 flex flex-col gap-1 rounded border border-[#343d46] bg-[#161b20] p-1 shadow">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-white hover:bg-[#28323c]"
          onClick={() => setZoom((z) => Math.min(z + 0.25, 2.5))}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold text-white hover:bg-[#28323c]"
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.75))}
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded text-xs text-[#9ba5ae] hover:bg-[#28323c]"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          aria-label="Reset view"
          title="Reset view"
        >
          ⟲
        </button>
      </div>

      {/* Issues Callouts */}
      {callouts.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-10 z-10 flex max-w-[280px] flex-col gap-1.5">
          {callouts.slice(0, 2).map((c) => (
            <div
              key={c}
              className="rounded border border-[#c45c5c]/60 bg-[#2d1b1bd9] px-2.5 py-1.5 text-[12px] font-medium text-[#fca5a5] shadow backdrop-blur"
            >
              ⚠ {c}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
