"use client";

import { useEffect, useRef } from "react";
import type { Cue, CueRole } from "@/lib/types";
import {
  ACTIVE_ROUTE,
  ALT_ROUTE,
  DESTINATION_POINT,
  HAZARD_POINT,
  MELBOURNE_CENTER,
  ORIGIN_POINT,
} from "@/lib/demo";

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
  resetToken?: number;
};

type LeafletNS = typeof import("leaflet");

function toLatLngs(coords: [number, number][]): [number, number][] {
  return coords.map(([lng, lat]) => [lat, lng]);
}

function dashArray(pattern?: string): string | undefined {
  if (pattern === "dashed") return "12, 10";
  if (pattern === "dotted") return "2, 8";
  return undefined;
}

function pinIcon(
  L: LeafletNS,
  colour: string,
  label: string,
  failing: boolean,
  icon: string
) {
  const shape =
    icon === "triangle"
      ? `<div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:16px solid ${colour};${failing ? "filter:drop-shadow(0 0 3px #c45c5c);" : ""}"></div>`
      : `<div style="width:16px;height:16px;background:${colour};border:2px solid ${failing ? "#c45c5c" : "#0f1113"};border-radius:${icon === "square" ? "2px" : "50%"};box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`;
  return L.divIcon({
    className: "cuelock-pin",
    html: `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">${shape}<div style="font:500 11px Inter,system-ui,sans-serif;color:#e8eaed;background:${failing ? "rgba(196,92,92,.92)" : "rgba(15,17,19,.88)"};padding:2px 6px;border-radius:3px;white-space:nowrap">${label}</div></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function MapWorkspace({
  cues,
  failingIds,
  callouts = [],
  resetToken = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const layersRef = useRef<{
    active?: import("leaflet").Polyline;
    alt?: import("leaflet").Polyline;
    markers: import("leaflet").Marker[];
  }>({ markers: [] });
  const cuesRef = useRef(cues);
  const failRef = useRef(failingIds);
  cuesRef.current = cues;
  failRef.current = failingIds;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const leafletMod = await import("leaflet");
      const L = ((leafletMod as { default?: LeafletNS }).default ??
        leafletMod) as LeafletNS;
      if (cancelled || !containerRef.current) return;
      LRef.current = L;

      const map = L.map(containerRef.current, {
        center: [MELBOURNE_CENTER[1], MELBOURNE_CENTER[0]],
        zoom: 15,
        zoomControl: true,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }
      ).addTo(map);

      mapRef.current = map;
      paint(L, map, cuesRef.current, failRef.current, layersRef);
      requestAnimationFrame(() => map.invalidateSize());
      window.setTimeout(() => map.invalidateSize(), 100);
    })().catch((err) => {
      console.error("Street map failed to load", err);
    });

    const onResize = () => mapRef.current?.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = { markers: [] };
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    paint(L, map, cues, failingIds, layersRef);
  }, [cues, failingIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || resetToken === 0) return;
    map.setView([MELBOURNE_CENTER[1], MELBOURNE_CENTER[0]], 15);
    map.invalidateSize();
  }, [resetToken]);

  const active = cues.find((c) => (c.geometryRef ?? c.id) === "route-active");
  const alt = cues.find((c) => (c.geometryRef ?? c.id) === "route-alt");

  return (
    <div className="relative h-full min-h-[420px] w-full">
      <div ref={containerRef} className="absolute inset-0 z-0 bg-[#1a1e24]" />
      <div className="pointer-events-none absolute left-3 top-3 z-[1000] max-w-[calc(100%-80px)] text-[13px] font-medium text-[#c5cad0]">
        Melbourne CBD · Flinders St → Melbourne Central
      </div>
      {callouts.length > 0 && (
        <div className="pointer-events-none absolute left-3 top-10 z-[1000] flex max-w-[260px] flex-col gap-1.5">
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
      <div className="pointer-events-none absolute bottom-8 left-3 z-[1000] flex items-center gap-4 rounded border border-[#2a2f36] bg-[#12161c]/92 px-3 py-2 text-[11px] text-[#8b929a]">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-7"
            style={{ background: active?.colour ?? "#22c55e" }}
          />
          Main
        </span>
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-0.5 w-7"
            style={{
              backgroundImage:
                alt?.secondaryEncoding.pattern === "dashed"
                  ? `repeating-linear-gradient(90deg, ${alt?.colour ?? "#ef4444"} 0 8px, transparent 8px 14px)`
                  : undefined,
              backgroundColor:
                alt?.secondaryEncoding.pattern === "dashed"
                  ? "transparent"
                  : alt?.colour ?? "#ef4444",
            }}
          />
          Backup
          {alt?.secondaryEncoding.pattern === "dashed" ? " (dashed)" : ""}
        </span>
      </div>
    </div>
  );
}

function paint(
  L: LeafletNS,
  map: import("leaflet").Map,
  cues: Cue[],
  failingIds: Set<string>,
  layersRef: React.MutableRefObject<{
    active?: import("leaflet").Polyline;
    alt?: import("leaflet").Polyline;
    markers: import("leaflet").Marker[];
  }>
) {
  const prev = layersRef.current;
  if (prev.active) map.removeLayer(prev.active);
  if (prev.alt) map.removeLayer(prev.alt);
  prev.markers.forEach((m) => map.removeLayer(m));

  const byRef = new Map(cues.map((c) => [c.geometryRef ?? c.id, c]));
  const active = byRef.get("route-active");
  const alt = byRef.get("route-alt");

  const altLine = L.polyline(toLatLngs(ALT_ROUTE), {
    color: alt?.colour ?? "#ef4444",
    weight: alt?.secondaryEncoding.width ?? 5,
    dashArray: dashArray(alt?.secondaryEncoding.pattern),
    opacity: 0.95,
    lineCap: "round",
    lineJoin: "round",
  }).addTo(map);

  const activeLine = L.polyline(toLatLngs(ACTIVE_ROUTE), {
    color: active?.colour ?? "#22c55e",
    weight: active?.secondaryEncoding.width ?? 5,
    dashArray: dashArray(active?.secondaryEncoding.pattern),
    opacity: 1,
    lineCap: "round",
    lineJoin: "round",
  }).addTo(map);

  const markers: import("leaflet").Marker[] = [];

  markers.push(
    L.marker([ORIGIN_POINT[1], ORIGIN_POINT[0]], {
      icon: pinIcon(L, "#111827", "Start", false, "circle"),
      interactive: false,
    }).addTo(map)
  );

  const hazard = byRef.get("hazard");
  if (hazard) {
    markers.push(
      L.marker([HAZARD_POINT[1], HAZARD_POINT[0]], {
        icon: pinIcon(
          L,
          hazard.colour,
          FRIENDLY.hazard ?? "Hazard",
          failingIds.has(hazard.id),
          hazard.secondaryEncoding.icon ?? "circle"
        ),
        interactive: false,
      }).addTo(map)
    );
  }

  const dest = byRef.get("destination");
  if (dest) {
    markers.push(
      L.marker([DESTINATION_POINT[1], DESTINATION_POINT[0]], {
        icon: pinIcon(
          L,
          dest.colour,
          FRIENDLY.destination ?? "Destination",
          failingIds.has(dest.id),
          dest.secondaryEncoding.icon ?? "circle"
        ),
        interactive: false,
      }).addTo(map)
    );
  }

  layersRef.current = { active: activeLine, alt: altLine, markers };
  map.invalidateSize();
}
