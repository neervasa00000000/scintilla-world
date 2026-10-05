"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { ACTIVE_ROUTE, ALT_ROUTE, DESTINATION_POINT, HAZARD_POINT, MELBOURNE_CENTER } from "@/lib/demo";
import { simulateHex } from "@/lib/cvd";
import type { Cue, CvdMode } from "@/lib/types";

type Point = [number, number];
type Props = {
  cues: Cue[];
  cvdMode: CvdMode;
  failingIds: Set<string>;
  selectedCueId?: string | null;
  placingCueId?: string | null;
  targetCenter?: [number, number] | null;
  onSelectCue?: (id: string) => void;
  onPlaceCoordinate?: (point: Point) => void;
  onUnavailable?: () => void;
};

function geometry(cue: Cue): Point | Point[] | null {
  if (cue.coordinates) return cue.coordinates;
  if (cue.geometryRef === "route-active") return ACTIVE_ROUTE;
  if (cue.geometryRef === "route-alt") return ALT_ROUTE;
  if (cue.geometryRef === "hazard") return HAZARD_POINT;
  if (cue.geometryRef === "destination") return DESTINATION_POINT;
  return null;
}

function isPoint(value: Point | Point[]): value is Point {
  return typeof value[0] === "number";
}

function isValidPoint(value: unknown): value is Point {
  return Array.isArray(value) && value.length === 2 &&
    value.every((number) => typeof number === "number" && Number.isFinite(number)) &&
    Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}

function safeColour(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#e6b452";
}

function markerIcon(L: typeof Leaflet, colour: string, shape: string, selected: boolean, failing: boolean) {
  const markerShape = ["triangle", "square", "diamond"].includes(shape) ? shape : "circle";
  const border = selected ? "#e6b452" : failing ? "#ff7878" : "#11181c";
  return L.divIcon({
    className: "cuelock-street-icon",
    html: `<span class="cuelock-street-marker ${markerShape}" style="--marker-colour:${safeColour(colour)};--marker-border:${border}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function StreetMap({ cues, cvdMode, failingIds, selectedCueId, placingCueId, targetCenter, onSelectCue, onPlaceCoordinate, onUnavailable }: Props) {
  const [ready, setReady] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const layersRef = useRef<Leaflet.LayerGroup | null>(null);
  const callbacksRef = useRef({ onSelectCue, onPlaceCoordinate, onUnavailable, placingCueId });
  const geometryKeyRef = useRef("");
  callbacksRef.current = { onSelectCue, onPlaceCoordinate, onUnavailable, placingCueId };

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      const leafletModule = await import("leaflet");
      const L = (leafletModule.default ?? leafletModule) as typeof Leaflet;
      if (cancelled || !elementRef.current) return;
      leafletRef.current = L;
      const map = L.map(elementRef.current, {
        center: [MELBOURNE_CENTER[1], MELBOURNE_CENTER[0]],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: false,
      });
      mapRef.current = map;
      layersRef.current = L.layerGroup().addTo(map);
      let tileFailures = 0;
      let tileSuccess = false;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 19,
        minZoom: 2,
        crossOrigin: true,
      }).on("tileload", () => { tileSuccess = true; }).on("tileerror", () => {
        tileFailures++;
        if (!tileSuccess && tileFailures >= 4) callbacksRef.current.onUnavailable?.();
      }).addTo(map);
      map.on("click", (event: Leaflet.LeafletMouseEvent) => {
        if (callbacksRef.current.placingCueId) {
          callbacksRef.current.onPlaceCoordinate?.([event.latlng.lng, event.latlng.lat]);
        }
      });
      requestAnimationFrame(() => map.invalidateSize());
      setReady(true);
    };
    start().catch(() => callbacksRef.current.onUnavailable?.());
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = null;
      leafletRef.current = null;
      geometryKeyRef.current = "";
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!L || !map || !layers) return;
    layers.clearLayers();
    const bounds: Leaflet.LatLngTuple[] = [];

    for (const cue of cues) {
      const data = geometry(cue);
      if (!data) continue;
      const colour = cvdMode === "normal" ? safeColour(cue.colour) : simulateHex(safeColour(cue.colour), cvdMode);
      const selected = selectedCueId === cue.id;
      const failing = failingIds.has(cue.id);
      if (isPoint(data)) {
        if (!isValidPoint(data)) continue;
        const point: Leaflet.LatLngTuple = [data[1], data[0]];
        bounds.push(point);
        const marker = L.marker(point, {
          icon: markerIcon(L, colour, cue.secondaryEncoding.icon ?? "circle", selected, failing),
          title: cue.label,
          keyboard: true,
        }).addTo(layers);
        marker.on("click", (event: Leaflet.LeafletMouseEvent) => {
          if (callbacksRef.current.placingCueId) {
            L.DomEvent.stopPropagation(event.originalEvent);
            callbacksRef.current.onPlaceCoordinate?.([event.latlng.lng, event.latlng.lat]);
          } else callbacksRef.current.onSelectCue?.(cue.id);
        });
        const label = document.createElement("span");
        label.textContent = cue.label;
        marker.bindTooltip(label, {
          permanent: Boolean(cue.secondaryEncoding.labelOnMap),
          direction: "right",
          className: "cuelock-street-label",
          offset: [12, 0],
        });
      } else {
        const valid = data.filter(isValidPoint);
        if (valid.length === 1) {
          const first: Leaflet.LatLngTuple = [valid[0][1], valid[0][0]];
          bounds.push(first);
          L.circleMarker(first, { radius: 7, color: "#152127", weight: 2, fillColor: colour, fillOpacity: 1 })
            .bindTooltip("First route point")
            .addTo(layers);
          continue;
        }
        if (valid.length < 2) continue;
        const line = valid.map(([lng, lat]) => [lat, lng] as Leaflet.LatLngTuple);
        bounds.push(...line);
        const polyline = L.polyline(line, {
          color: colour,
          weight: Math.max(3, cue.secondaryEncoding.width ?? 5) + (selected ? 2 : 0),
          dashArray: cue.secondaryEncoding.pattern === "dashed" ? "12 9" : cue.secondaryEncoding.pattern === "dotted" ? "3 8" : undefined,
          opacity: selected ? 1 : .94,
          lineCap: "round",
          lineJoin: "round",
          className: failing ? "cuelock-street-failing" : undefined,
        }).addTo(layers);
        polyline.on("click", (event: Leaflet.LeafletMouseEvent) => {
          if (callbacksRef.current.placingCueId) {
            L.DomEvent.stopPropagation(event.originalEvent);
            callbacksRef.current.onPlaceCoordinate?.([event.latlng.lng, event.latlng.lat]);
          } else callbacksRef.current.onSelectCue?.(cue.id);
        });
        const label = document.createElement("span");
        label.textContent = cue.label;
        polyline.bindTooltip(label, { sticky: true, className: "cuelock-street-label" });
      }
    }

    const key = JSON.stringify(cues.map((cue) => [cue.id, geometry(cue)]));
    if (key !== geometryKeyRef.current && bounds.length > 0 && !placingCueId) {
      map.fitBounds(L.latLngBounds(bounds).pad(.22), { maxZoom: 16, animate: false });
    }
    geometryKeyRef.current = key;
  }, [cues, cvdMode, failingIds, selectedCueId, placingCueId, ready]);

  useEffect(() => {
    if (!ready || !targetCenter || !mapRef.current) return;
    mapRef.current.setView(targetCenter, 15, { animate: true });
  }, [targetCenter, ready]);

  return <div ref={elementRef} className={`cuelock-street-map ${placingCueId ? "is-placing" : ""}`} aria-label="Interactive OpenStreetMap street map" />;
}
