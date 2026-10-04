/**
 * Melbourne CBD demo: Flinders St → Melbourne Central.
 * Deliberately bad hue-only palette for the FAIL → PASS wow moment.
 */

import type { Cue } from "./types";

/** [lng, lat] */
export const MELBOURNE_CENTER: [number, number] = [144.9631, -37.8136];

export const ACTIVE_ROUTE: [number, number][] = [
  [144.9671, -37.8183], // Flinders Street Station
  [144.9662, -37.8165],
  [144.9645, -37.8148],
  [144.9633, -37.8132],
  [144.9625, -37.8118],
  [144.9628, -37.8101], // Melbourne Central
];

export const ALT_ROUTE: [number, number][] = [
  [144.9671, -37.8183],
  [144.9685, -37.8168],
  [144.9692, -37.8142],
  [144.9670, -37.8115],
  [144.9640, -37.8105],
  [144.9628, -37.8101],
];

export const HAZARD_POINT: [number, number] = [144.9648, -37.8145];
export const DESTINATION_POINT: [number, number] = [144.9628, -37.8101];
export const ORIGIN_POINT: [number, number] = [144.9671, -37.8183];

/** Bad palette: green active, red alt, orange hazard, blue destination — hue-only. */
export function melbourneBadCues(): Cue[] {
  // Identical secondary encodings on purpose — colour-only navigation meaning.
  const hueOnly = {
    pattern: "solid" as const,
    width: 4,
    icon: undefined as string | undefined,
    labelOnMap: false,
  };
  return [
    {
      id: "cue-route-active",
      role: "route_active",
      label: "Main route (Flinders→Melb Central)",
      colour: "#22c55e",
      secondaryEncoding: { ...hueOnly },
      geometryRef: "route-active",
      coordinates: ACTIVE_ROUTE,
      critical: true,
    },
    {
      id: "cue-route-alt",
      role: "route_alt",
      label: "Backup route (via Exhibition St)",
      colour: "#ef4444",
      secondaryEncoding: { ...hueOnly },
      geometryRef: "route-alt",
      coordinates: ALT_ROUTE,
      critical: true,
    },
    {
      id: "cue-hazard",
      role: "hazard",
      label: "Hazard — roadworks",
      colour: "#f97316",
      secondaryEncoding: { ...hueOnly },
      geometryRef: "hazard",
      coordinates: HAZARD_POINT,
      critical: true,
    },
    {
      id: "cue-destination",
      role: "destination",
      label: "Destination — Melbourne Central",
      colour: "#3b82f6",
      secondaryEncoding: { ...hueOnly },
      geometryRef: "destination",
      coordinates: DESTINATION_POINT,
      critical: true,
    },
  ];
}

export const TRANSIT_ROUTE: [number, number][] = [
  [144.9610, -37.8180],
  [144.9630, -37.8150],
  [144.9660, -37.8120],
  [144.9680, -37.8090],
];

export const WALK_ROUTE: [number, number][] = [
  [144.9610, -37.8180],
  [144.9605, -37.8145],
  [144.9635, -37.8115],
  [144.9680, -37.8090],
];

export function transitVsWalkCues(): Cue[] {
  const hueOnly = {
    pattern: "solid" as const,
    width: 4,
    icon: undefined,
    labelOnMap: false,
  };
  return [
    {
      id: "cue-transit",
      role: "mode_transit",
      label: "Transit rail / bus route",
      colour: "#dc2626",
      secondaryEncoding: { ...hueOnly },
      coordinates: TRANSIT_ROUTE,
      critical: true,
    },
    {
      id: "cue-walk",
      role: "mode_walk",
      label: "Pedestrian walkway",
      colour: "#16a34a",
      secondaryEncoding: { ...hueOnly },
      coordinates: WALK_ROUTE,
      critical: true,
    },
    {
      id: "cue-station",
      role: "hazard",
      label: "Track closure / delay",
      colour: "#ea580c",
      secondaryEncoding: { ...hueOnly },
      coordinates: [144.9630, -37.8150],
      critical: true,
    },
    {
      id: "cue-terminus",
      role: "destination",
      label: "Transfer hub",
      colour: "#2563eb",
      secondaryEncoding: { ...hueOnly },
      coordinates: [144.9680, -37.8090],
      critical: true,
    },
  ];
}

export function emergencyEvacCues(): Cue[] {
  const hueOnly = {
    pattern: "solid" as const,
    width: 4,
    icon: undefined,
    labelOnMap: false,
  };
  return [
    {
      id: "cue-evac-primary",
      role: "route_active",
      label: "Primary egress path",
      colour: "#22c55e",
      secondaryEncoding: { ...hueOnly },
      coordinates: ACTIVE_ROUTE,
      critical: true,
    },
    {
      id: "cue-evac-secondary",
      role: "route_alt",
      label: "Secondary exit corridor",
      colour: "#ef4444",
      secondaryEncoding: { ...hueOnly },
      coordinates: ALT_ROUTE,
      critical: true,
    },
    {
      id: "cue-evac-hazard",
      role: "hazard",
      label: "Hazard perimeter",
      colour: "#f59e0b",
      secondaryEncoding: { ...hueOnly },
      coordinates: HAZARD_POINT,
      critical: true,
    },
    {
      id: "cue-evac-assembly",
      role: "destination",
      label: "Assembly point B",
      colour: "#3b82f6",
      secondaryEncoding: { ...hueOnly },
      coordinates: DESTINATION_POINT,
      critical: true,
    },
  ];
}

export function routeGeoJSON() {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        id: "route-active",
        properties: { id: "route-active", role: "route_active" },
        geometry: { type: "LineString" as const, coordinates: ACTIVE_ROUTE },
      },
      {
        type: "Feature" as const,
        id: "route-alt",
        properties: { id: "route-alt", role: "route_alt" },
        geometry: { type: "LineString" as const, coordinates: ALT_ROUTE },
      },
      {
        type: "Feature" as const,
        id: "hazard",
        properties: { id: "hazard", role: "hazard" },
        geometry: { type: "Point" as const, coordinates: HAZARD_POINT },
      },
      {
        type: "Feature" as const,
        id: "destination",
        properties: { id: "destination", role: "destination" },
        geometry: { type: "Point" as const, coordinates: DESTINATION_POINT },
      },
      {
        type: "Feature" as const,
        id: "origin",
        properties: { id: "origin", role: "custom" },
        geometry: { type: "Point" as const, coordinates: ORIGIN_POINT },
      },
    ],
  };
}

