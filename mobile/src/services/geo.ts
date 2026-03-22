/**
 * Geo/mapping API client for course map data.
 * Consumes the /api/v1/geo/* endpoints built by Terminal 3.
 */

// Types and helpers for geo/mapping features

// ── GeoJSON Types ──

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

export interface GeoJSONLineString {
  type: "LineString";
  coordinates: [number, number][];
}

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}

export interface GeoJSONFeature {
  type: "Feature";
  id?: string;
  geometry: GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon | null;
  properties: Record<string, unknown>;
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export interface ElevationProfile {
  hole_number: number;
  tee_elevation_ft: number | null;
  basket_elevation_ft: number | null;
  elevation_change_ft: number | null;
  profile: Array<{ distance_ft: number; elevation_ft: number }>;
}

export interface NearestHoleResult {
  hole_number: number;
  layout_id: number;
  layout_name: string;
  distance_meters: number;
  distance_feet: number;
  par: number;
  hole_distance_ft: number | null;
  tee_coords: [number, number] | null;
  basket_coords: [number, number] | null;
}

// NOTE: Geo API client is in api.ts (geoApi export). This file provides
// types and helper functions only. Use `import { geoApi } from "@/services/api"`
// for API calls.

// ── Helpers ──

/** Calculate distance in feet between two [lng, lat] points using Haversine. */
export function distanceFeet(
  a: [number, number],
  b: [number, number]
): number {
  const R = 20902231; // Earth radius in feet
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Calculate distance in meters. */
export function distanceMeters(
  a: [number, number],
  b: [number, number]
): number {
  return distanceFeet(a, b) * 0.3048;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Get the center point of a set of coordinates. */
export function getCenter(
  coords: [number, number][]
): [number, number] {
  if (coords.length === 0) return [0, 0];
  const sum = coords.reduce(
    (acc, c) => [acc[0] + c[0], acc[1] + c[1]],
    [0, 0]
  );
  return [sum[0] / coords.length, sum[1] / coords.length];
}
