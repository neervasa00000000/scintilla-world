"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
} from "maplibre-gl";
import type { Map as MapLibreMapType, Marker as MarkerType } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MELBOURNE_CENTER,
  routeGeoJSON,
} from "@/lib/demo";
import type { Cue, CueRole } from "@/lib/types";

const FRIENDLY: Partial<Record<CueRole, string>> = {
  route_active: "Main route",
  route_alt: "Backup route",
  hazard: "Hazard",
  destination: "Destination",
};

type Props = {
  cues: Cue[];
  failingIds: Set<string>;
  callouts?: string[];
  /** Bump to force camera reset (Melbourne demo). */
  resetToken?: number;
  onMapReady?: (map: MapLibreMapType) => void;
};

function dashFor(pattern?: string): [number, number] {
  if (pattern === "dashed") return [2, 2];
  if (pattern === "dotted") return [0.8, 1.6];
  // solid — MapLibre needs a dasharray property present to update later
  return [1, 0];
}

export function MapWorkspace({
  cues,
  failingIds,
  callouts = [],
  resetToken = 0,
  onMapReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMapType | null>(null);
  const markersRef = useRef<MarkerType[]>([]);
  const cuesRef = useRef(cues);
  const failRef = useRef(failingIds);
  cuesRef.current = cues;
  failRef.current = failingIds;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: MELBOURNE_CENTER,
      zoom: 14.2,
      attributionControl: { compact: true },
    });

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("cuelock-routes", {
        type: "geojson",
        data: routeGeoJSON(),
      });

      // Both lines get dasharray so setPaintProperty works later
      map.addLayer({
        id: "route-alt-line",
        type: "line",
        source: "cuelock-routes",
        filter: ["==", ["get", "id"], "route-alt"],
        paint: {
          "line-color": "#ef4444",
          "line-width": 4,
          "line-dasharray": [1, 0],
          "line-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "route-active-line",
        type: "line",
        source: "cuelock-routes",
        filter: ["==", ["get", "id"], "route-active"],
        paint: {
          "line-color": "#22c55e",
          "line-width": 4,
          "line-dasharray": [1, 0],
          "line-opacity": 1,
        },
      });

      mapRef.current = map;
      onMapReady?.(map);
      paintCues(map, cuesRef.current, failRef.current, markersRef);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repaint whenever cues / failures change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const paint = () => paintCues(map, cues, failingIds, markersRef);
    if (map.isStyleLoaded()) paint();
    else map.once("load", paint);
  }, [cues, failingIds]);

  // Reset camera on Melbourne demo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || resetToken === 0) return;
    map.flyTo({ center: MELBOURNE_CENTER, zoom: 14.2, essential: true });
  }, [resetToken]);

  return (
    <div className="relative h-full w-full min-h-[320px]">
      <div ref={containerRef} className="absolute inset-0" />
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

function paintCues(
  map: MapLibreMapType,
  cues: Cue[],
  failingIds: Set<string>,
  markersRef: React.MutableRefObject<MarkerType[]>
) {
  if (!map.getLayer("route-active-line")) return;

  const byRef = new Map(cues.map((c) => [c.geometryRef ?? c.id, c]));
  const active = byRef.get("route-active");
  const alt = byRef.get("route-alt");

  if (active) {
    map.setPaintProperty("route-active-line", "line-color", active.colour);
    map.setPaintProperty(
      "route-active-line",
      "line-width",
      active.secondaryEncoding.width ?? 4
    );
    map.setPaintProperty(
      "route-active-line",
      "line-dasharray",
      dashFor(active.secondaryEncoding.pattern)
    );
  }

  if (alt) {
    map.setPaintProperty("route-alt-line", "line-color", alt.colour);
    map.setPaintProperty(
      "route-alt-line",
      "line-width",
      alt.secondaryEncoding.width ?? 4
    );
    map.setPaintProperty(
      "route-alt-line",
      "line-dasharray",
      dashFor(alt.secondaryEncoding.pattern)
    );
  }

  markersRef.current.forEach((m) => m.remove());
  markersRef.current = [];

  const geo = routeGeoJSON();
  for (const f of geo.features) {
    if (f.geometry.type !== "Point") continue;
    const id = String(f.properties?.id ?? "");
    const cue = byRef.get(id);

    if (!cue && id === "origin") {
      const el = markerEl("#111827", "Start", false, "circle");
      markersRef.current.push(
        new Marker({ element: el })
          .setLngLat(f.geometry.coordinates as [number, number])
          .addTo(map)
      );
      continue;
    }
    if (!cue) continue;

    const failing = failingIds.has(cue.id);
    const label = cue.secondaryEncoding.labelOnMap
      ? FRIENDLY[cue.role] ?? cue.role
      : FRIENDLY[cue.role] ?? cue.role;
    const el = markerEl(
      cue.colour,
      label,
      failing,
      cue.secondaryEncoding.icon ?? "circle"
    );
    markersRef.current.push(
      new Marker({ element: el })
        .setLngLat(f.geometry.coordinates as [number, number])
        .addTo(map)
    );
  }
}

function markerEl(
  colour: string,
  label: string,
  failing: boolean,
  icon: string
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:flex;flex-direction:column;align-items:center;gap:2px;";

  const shape = document.createElement("div");
  if (icon === "triangle") {
    shape.style.cssText = `width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:16px solid ${colour};${
      failing ? "filter:drop-shadow(0 0 3px #c45c5c);" : ""
    }`;
  } else {
    shape.style.cssText = `width:16px;height:16px;background:${colour};border:2px solid ${
      failing ? "#c45c5c" : "#0f1113"
    };border-radius:${icon === "square" ? "2px" : "50%"};box-shadow:${
      failing ? "0 0 0 2px rgba(196,92,92,0.45)" : "0 1px 3px rgba(0,0,0,0.35)"
    };`;
  }
  wrap.appendChild(shape);

  const text = document.createElement("div");
  text.textContent = label;
  text.style.cssText = `font-size:11px;font-family:Inter,system-ui,sans-serif;color:#e8eaed;background:${
    failing ? "rgba(196,92,92,0.92)" : "rgba(15,17,19,0.88)"
  };padding:2px 6px;border-radius:3px;white-space:nowrap;`;
  wrap.appendChild(text);

  return wrap;
}
