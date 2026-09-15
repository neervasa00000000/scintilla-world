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

function calloutForRole(role: CueRole): string {
  if (role === "route_active" || role === "route_alt") {
    return "These routes look too similar";
  }
  if (role === "hazard") return "Hazard may be missed";
  return "Hard to tell apart";
}

type Props = {
  cues: Cue[];
  failingIds: Set<string>;
  callouts?: string[];
  onMapReady?: (map: MapLibreMapType) => void;
};

function dashArray(pattern?: string): number[] {
  if (pattern === "dashed") return [2, 2];
  if (pattern === "dotted") return [0.5, 1.5];
  return [1];
}

export function MapWorkspace({
  cues,
  failingIds,
  callouts = [],
  onMapReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMapType | null>(null);
  const markersRef = useRef<MarkerType[]>([]);

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
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
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

      map.addLayer({
        id: "route-alt-line",
        type: "line",
        source: "cuelock-routes",
        filter: ["==", ["get", "id"], "route-alt"],
        paint: {
          "line-color": "#ef4444",
          "line-width": 5,
          "line-dasharray": [1],
        },
      });

      map.addLayer({
        id: "route-active-line",
        type: "line",
        source: "cuelock-routes",
        filter: ["==", ["get", "id"], "route-active"],
        paint: {
          "line-color": "#22c55e",
          "line-width": 5,
        },
      });

      mapRef.current = map;
      onMapReady?.(map);
      paintCues(map, cues, failingIds, markersRef);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    paintCues(map, cues, failingIds, markersRef);
  }, [cues, failingIds]);

  return (
    <div className="relative h-full w-full min-h-[320px]">
      <div ref={containerRef} className="h-full w-full" />
      {callouts.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[280px] flex-col gap-1.5">
          {callouts.slice(0, 3).map((c) => (
            <div
              key={c}
              className="rounded border border-[#c45c5c]/60 bg-[#c45c5c]/90 px-2 py-1 text-[11px] font-medium text-white shadow"
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
  const byRef = new Map(cues.map((c) => [c.geometryRef ?? c.id, c]));

  const active = byRef.get("route-active");
  const alt = byRef.get("route-alt");

  if (active && map.getLayer("route-active-line")) {
    map.setPaintProperty("route-active-line", "line-color", active.colour);
    map.setPaintProperty(
      "route-active-line",
      "line-width",
      active.secondaryEncoding.width ?? 5
    );
    const dash = dashArray(active.secondaryEncoding.pattern);
    try {
      map.setPaintProperty("route-active-line", "line-dasharray", dash);
    } catch {
      /* solid */
    }
  }

  if (alt && map.getLayer("route-alt-line")) {
    map.setPaintProperty("route-alt-line", "line-color", alt.colour);
    map.setPaintProperty(
      "route-alt-line",
      "line-width",
      alt.secondaryEncoding.width ?? 5
    );
    const dash = dashArray(alt.secondaryEncoding.pattern);
    try {
      map.setPaintProperty("route-alt-line", "line-dasharray", dash);
    } catch {
      /* */
    }
  }

  markersRef.current.forEach((m) => m.remove());
  markersRef.current = [];

  const geo = routeGeoJSON();
  for (const f of geo.features) {
    if (f.geometry.type !== "Point") continue;
    const id = String(f.properties?.id ?? "");
    const cue = byRef.get(id);
    if (!cue && id === "origin") {
      const el = markerEl("#111827", "Origin", false, "circle");
      const m = new Marker({ element: el })
        .setLngLat(f.geometry.coordinates as [number, number])
        .addTo(map);
      markersRef.current.push(m);
      continue;
    }
    if (!cue) continue;
    const failing = failingIds.has(cue.id);
    const el = markerEl(
      cue.colour,
      cue.secondaryEncoding.labelOnMap
        ? cue.label.split("—")[0].trim()
        : FRIENDLY[cue.role] ?? cue.role,
      failing,
      cue.secondaryEncoding.icon ?? "circle",
      failing ? calloutForRole(cue.role) : undefined
    );
    const m = new Marker({ element: el })
      .setLngLat(f.geometry.coordinates as [number, number])
      .addTo(map);
    markersRef.current.push(m);
  }
}

function markerEl(
  colour: string,
  label: string,
  failing: boolean,
  icon: string,
  failNote?: string
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.alignItems = "center";
  wrap.style.gap = "2px";

  const shape = document.createElement("div");
  shape.style.width = "16px";
  shape.style.height = "16px";
  shape.style.background = colour;
  shape.style.border = failing ? "2px solid #c45c5c" : "2px solid #0f1113";
  shape.style.boxShadow = failing
    ? "0 0 0 2px rgba(196,92,92,0.5)"
    : "0 1px 3px rgba(0,0,0,0.35)";
  if (icon === "triangle") {
    shape.style.width = "0";
    shape.style.height = "0";
    shape.style.background = "transparent";
    shape.style.border = "none";
    shape.style.borderLeft = "9px solid transparent";
    shape.style.borderRight = "9px solid transparent";
    shape.style.borderBottom = `16px solid ${colour}`;
    shape.style.boxShadow = "none";
    if (failing) {
      shape.style.filter = "drop-shadow(0 0 2px #c45c5c)";
    }
  } else if (icon === "square") {
    shape.style.borderRadius = "2px";
  } else {
    shape.style.borderRadius = "50%";
  }
  wrap.appendChild(shape);

  const text = document.createElement("div");
  text.textContent = failing && failNote ? failNote : label;
  text.style.fontSize = "10px";
  text.style.fontFamily = "Inter, system-ui, sans-serif";
  text.style.color = "#e8eaed";
  text.style.background = failing
    ? "rgba(196,92,92,0.92)"
    : "rgba(15,17,19,0.85)";
  text.style.padding = "2px 5px";
  text.style.borderRadius = "3px";
  text.style.whiteSpace = "nowrap";
  text.style.maxWidth = "160px";
  text.style.overflow = "hidden";
  text.style.textOverflow = "ellipsis";
  wrap.appendChild(text);

  return wrap;
}
