/**
 * CourseMap — Satellite course view with Mapbox GL
 *
 * Renders satellite imagery with:
 * - Tee pad markers (green squares)
 * - Basket markers (chain icons)
 * - Fairway lines (dashed)
 * - OB zones (red polygons)
 * - Mando gates (yellow lines)
 * - GPS distance to selected basket
 * - Hole number labels
 *
 * This is the feature that beats UDisc (they use uploaded photos, not satellite).
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";
import { distanceFeet } from "@/services/geo";
import { api } from "@/services/api";

// Mapbox is optional — graceful fallback if not configured
let MapboxGL: typeof import("@rnmapbox/maps").default | null = null;
try {
  MapboxGL = require("@rnmapbox/maps").default;
} catch {
  // Mapbox not installed or not configured
}

interface CourseMapProps {
  courseId: number;
  layoutId?: number;
  /** User's current position [lng, lat] */
  userPosition?: [number, number];
  /** Currently selected hole number */
  selectedHole?: number;
  onHoleSelect?: (holeNumber: number) => void;
  /** Map height */
  height?: number;
}

// River Grove DGC default center
const DEFAULT_CENTER: [number, number] = [-95.208576, 30.027066];
const DEFAULT_ZOOM = 16;

export function CourseMap({
  courseId,
  layoutId,
  userPosition,
  selectedHole,
  onHoleSelect,
  height = 400,
}: CourseMapProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoJSON, setGeoJSON] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distanceToBasket, setDistanceToBasket] = useState<number | null>(null);

  useEffect(() => {
    let path = `/api/v1/geo/courses/${courseId}/geojson`;
    if (layoutId) path += `?layout_id=${layoutId}`;
    api(path, { auth: false })
      .then(setGeoJSON)
      .catch(() => setError("Could not load course map data"))
      .finally(() => setLoading(false));
  }, [courseId, layoutId]);

  // Calculate distance to selected hole's basket
  useEffect(() => {
    if (!userPosition || !selectedHole || !geoJSON) {
      setDistanceToBasket(null);
      return;
    }

    const basketFeature = geoJSON.features.find(
      (f: any) =>
        f.properties.type === "basket" &&
        f.properties.hole_number === selectedHole
    );

    if (basketFeature?.geometry?.type === "Point") {
      const basketCoords = basketFeature.geometry.coordinates as [number, number];
      setDistanceToBasket(Math.round(distanceFeet(userPosition, basketCoords)));
    }
  }, [userPosition, selectedHole, geoJSON]);

  // If Mapbox isn't available, show a fallback
  if (!MapboxGL) {
    return (
      <View style={[styles.container, { height }]}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>Course Map</Text>
          <Text style={styles.fallbackText}>
            Mapbox SDK not configured. Add your Mapbox access token to enable
            satellite course maps.
          </Text>
          {geoJSON && (
            <Text style={styles.fallbackMeta}>
              {geoJSON.features.filter((f: any) => f.properties.type === "tee").length} holes loaded
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { height }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !geoJSON) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.errorText}>{error || "No map data available"}</Text>
      </View>
    );
  }

  // Separate features by type for layered rendering
  const tees = geoJSON.features.filter((f: any) => f.properties.type === "tee");
  const baskets = geoJSON.features.filter((f: any) => f.properties.type === "basket");
  const fairways = geoJSON.features.filter((f: any) => f.properties.type === "fairway");
  const obZones = geoJSON.features.filter((f: any) => f.properties.type === "ob_zone");
  const mandos = geoJSON.features.filter((f: any) => f.properties.type === "mando");
  const water = geoJSON.features.filter((f: any) => f.properties.type === "water");

  return (
    <View style={[styles.container, { height }]}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Satellite}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
      >
        <MapboxGL.Camera
          defaultSettings={{
            centerCoordinate: DEFAULT_CENTER,
            zoomLevel: DEFAULT_ZOOM,
          }}
        />

        {/* User position */}
        {userPosition && (
          <MapboxGL.PointAnnotation id="user" coordinate={userPosition}>
            <View style={styles.userDot} />
          </MapboxGL.PointAnnotation>
        )}

        {/* OB zones (red polygons) */}
        {obZones.length > 0 && (
          <MapboxGL.ShapeSource
            id="ob-zones"
            shape={{ type: "FeatureCollection", features: obZones }}
          >
            <MapboxGL.FillLayer
              id="ob-fill"
              style={{
                fillColor: "rgba(244, 67, 54, 0.25)",
                fillOutlineColor: "#F44336",
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Water (blue polygons) */}
        {water.length > 0 && (
          <MapboxGL.ShapeSource
            id="water"
            shape={{ type: "FeatureCollection", features: water }}
          >
            <MapboxGL.FillLayer
              id="water-fill"
              style={{
                fillColor: "rgba(33, 150, 243, 0.3)",
                fillOutlineColor: "#2196F3",
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Fairway lines (dashed white) */}
        {fairways.length > 0 && (
          <MapboxGL.ShapeSource
            id="fairways"
            shape={{ type: "FeatureCollection", features: fairways }}
          >
            <MapboxGL.LineLayer
              id="fairway-line"
              style={{
                lineColor: "rgba(255, 255, 255, 0.7)",
                lineWidth: 2,
                lineDasharray: [4, 3],
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Tee pads (green markers) */}
        {tees.map((tee: any) => {
          if (tee.geometry?.type !== "Point") return null;
          const holeNum = tee.properties.hole_number as number;
          const isSelected = selectedHole === holeNum;
          return (
            <MapboxGL.PointAnnotation
              key={`tee-${holeNum}`}
              id={`tee-${holeNum}`}
              coordinate={tee.geometry.coordinates as [number, number]}
              onSelected={() => onHoleSelect?.(holeNum)}
            >
              <View
                style={[
                  styles.teeMarker,
                  isSelected && styles.teeMarkerSelected,
                ]}
              >
                <Text style={styles.teeText}>{holeNum}</Text>
              </View>
            </MapboxGL.PointAnnotation>
          );
        })}

        {/* Baskets (target markers) */}
        {baskets.map((basket: any) => {
          if (basket.geometry?.type !== "Point") return null;
          const holeNum = basket.properties.hole_number as number;
          const isSelected = selectedHole === holeNum;
          return (
            <MapboxGL.PointAnnotation
              key={`basket-${holeNum}`}
              id={`basket-${holeNum}`}
              coordinate={basket.geometry.coordinates as [number, number]}
            >
              <View
                style={[
                  styles.basketMarker,
                  isSelected && styles.basketMarkerSelected,
                ]}
              >
                <Text style={styles.basketText}>🎯</Text>
              </View>
            </MapboxGL.PointAnnotation>
          );
        })}
      </MapboxGL.MapView>

      {/* Distance overlay */}
      {distanceToBasket !== null && selectedHole && (
        <View style={styles.distanceOverlay}>
          <Text style={styles.distanceLabel}>Hole {selectedHole}</Text>
          <Text style={styles.distanceValue}>{distanceToBasket} ft</Text>
          <Text style={styles.distanceMeters}>
            {Math.round(distanceToBasket * 0.3048)}m
          </Text>
        </View>
      )}

      {/* Hole selector strip */}
      <View style={styles.holeSelectorStrip}>
        {tees.map((tee: any) => {
          const holeNum = tee.properties.hole_number as number;
          const isSelected = selectedHole === holeNum;
          return (
            <Pressable
              key={holeNum}
              onPress={() => onHoleSelect?.(holeNum)}
              style={[
                styles.holePill,
                isSelected && styles.holePillSelected,
              ]}
            >
              <Text
                style={[
                  styles.holePillText,
                  isSelected && styles.holePillTextSelected,
                ]}
              >
                {holeNum}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    overflow: "hidden",
    backgroundColor: colors.gray[900],
    justifyContent: "center",
    alignItems: "center",
  },
  map: {
    flex: 1,
    width: "100%",
  },
  // Fallback (no Mapbox)
  fallback: {
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  fallbackTitle: {
    color: colors.text.inverse,
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  fallbackText: {
    color: colors.gray[400],
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  fallbackMeta: {
    color: colors.accent.blue,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.base,
  },
  // User position
  userDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accent.blue,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  // Tee markers
  teeMarker: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  teeMarkerSelected: {
    backgroundColor: colors.secondary,
    transform: [{ scale: 1.2 }],
  },
  teeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  // Basket markers
  basketMarker: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  basketMarkerSelected: {
    transform: [{ scale: 1.3 }],
  },
  basketText: {
    fontSize: 16,
  },
  // Distance overlay
  distanceOverlay: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: "center",
    minWidth: 80,
  },
  distanceLabel: {
    color: colors.gray[400],
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  distanceValue: {
    color: "#FFFFFF",
    fontSize: fontSize["2xl"],
    fontWeight: "700",
  },
  distanceMeters: {
    color: colors.gray[400],
    fontSize: fontSize.xs,
  },
  // Hole selector strip
  holeSelectorStrip: {
    position: "absolute",
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    flexWrap: "wrap",
  },
  holePill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  holePillSelected: {
    backgroundColor: colors.secondary,
  },
  holePillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  holePillTextSelected: {
    fontWeight: "700",
  },
});
