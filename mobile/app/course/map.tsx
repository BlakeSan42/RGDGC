import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { geoApi } from "@/services/api";
import { distanceFeet } from "@/services/geo";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

// Mapbox is native-only — lazy import to avoid crash on web
let Mapbox: any = null;
let MapView: any = null;
let Camera: any = null;
let ShapeSource: any = null;
let SymbolLayer: any = null;
let LineLayer: any = null;
let CircleLayer: any = null;
let UserLocation: any = null;
let FillLayer: any = null;

if (Platform.OS !== "web") {
  const maps = require("@rnmapbox/maps");
  Mapbox = maps.default;
  MapView = maps.MapView;
  Camera = maps.Camera;
  ShapeSource = maps.ShapeSource;
  SymbolLayer = maps.SymbolLayer;
  LineLayer = maps.LineLayer;
  CircleLayer = maps.CircleLayer;
  UserLocation = maps.UserLocation;
  FillLayer = maps.FillLayer;

  const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "";
  Mapbox.setAccessToken(MAPBOX_TOKEN);
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "";
const DEFAULT_CENTER: [number, number] = [-95.208576, 30.027066];
const DEFAULT_ZOOM = 16.5;
const HOLE_ZOOM = 18;

interface HoleData {
  hole_number: number;
  par: number;
  distance_ft: number | null;
  elevation_change_ft: number | null;
  tee_coords: [number, number] | null;
  basket_coords: [number, number] | null;
}

export default function CourseMapScreen() {
  const { courseId, layoutId, courseName } = useLocalSearchParams<{
    courseId: string;
    layoutId?: string;
    courseName?: string;
  }>();
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHole, setSelectedHole] = useState<number | null>(null);
  const [mapStyle, setMapStyle] = useState<"satellite" | "streets">("satellite");
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [liveDistanceFt, setLiveDistanceFt] = useState<number | null>(null);
  const cameraRef = useRef<any>(null);

  // Parse hole data from GeoJSON
  const holes: HoleData[] = [];
  if (geojson) {
    const tees = geojson.features.filter((f) => f.properties?.type === "tee");
    for (const tee of tees) {
      const num = tee.properties?.hole_number as number;
      const basket = geojson.features.find(
        (f) => f.properties?.type === "basket" && f.properties?.hole_number === num
      );
      holes.push({
        hole_number: num,
        par: tee.properties?.par as number,
        distance_ft: tee.properties?.distance_ft as number | null,
        elevation_change_ft: (basket?.properties?.elevation_change_ft as number | null) ?? null,
        tee_coords: tee.geometry?.type === "Point" ? (tee.geometry.coordinates as [number, number]) : null,
        basket_coords: basket?.geometry?.type === "Point" ? (basket.geometry.coordinates as [number, number]) : null,
      });
    }
    holes.sort((a, b) => a.hole_number - b.hole_number);
  }

  const currentHole = holes.find((h) => h.hole_number === selectedHole) ?? null;

  // Load GeoJSON
  useEffect(() => {
    if (!courseId) return;
    geoApi
      .courseGeoJSON(Number(courseId), layoutId ? Number(layoutId) : undefined)
      .then(setGeojson)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [courseId, layoutId]);

  // GPS tracking
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 2 },
        (loc) => setUserPos([loc.coords.longitude, loc.coords.latitude])
      );
    })();
    return () => { sub?.remove(); };
  }, []);

  // Live distance to selected basket
  useEffect(() => {
    if (!userPos || !currentHole?.basket_coords) {
      setLiveDistanceFt(null);
      return;
    }
    setLiveDistanceFt(Math.round(distanceFeet(userPos, currentHole.basket_coords)));
  }, [userPos, currentHole]);

  // Auto-detect nearest hole on first GPS fix
  useEffect(() => {
    if (!userPos || selectedHole !== null || holes.length === 0) return;
    let closest: HoleData | null = null;
    let closestDist = Infinity;
    for (const h of holes) {
      if (!h.tee_coords) continue;
      const d = distanceFeet(userPos, h.tee_coords);
      if (d < closestDist) {
        closestDist = d;
        closest = h;
      }
    }
    if (closest && closestDist < 500) { // within 500ft of a tee
      setSelectedHole(closest.hole_number);
      flyToHole(closest);
    }
  }, [userPos, holes.length]);

  const flyToHole = useCallback((hole: HoleData) => {
    if (!hole.tee_coords || !hole.basket_coords) return;
    // Center between tee and basket
    const center: [number, number] = [
      (hole.tee_coords[0] + hole.basket_coords[0]) / 2,
      (hole.tee_coords[1] + hole.basket_coords[1]) / 2,
    ];
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel: HOLE_ZOOM,
      animationDuration: 600,
      pitch: 30,
    });
  }, []);

  const selectHole = useCallback((num: number) => {
    setSelectedHole(num);
    const hole = holes.find((h) => h.hole_number === num);
    if (hole) flyToHole(hole);
  }, [holes, flyToHole]);

  const nextHole = () => {
    const idx = holes.findIndex((h) => h.hole_number === selectedHole);
    if (idx >= 0 && idx < holes.length - 1) selectHole(holes[idx + 1].hole_number);
  };

  const prevHole = () => {
    const idx = holes.findIndex((h) => h.hole_number === selectedHole);
    if (idx > 0) selectHole(holes[idx - 1].hole_number);
  };

  const centerOnCourse = () => {
    const center = (geojson as any)?.properties?.center ?? DEFAULT_CENTER;
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel: DEFAULT_ZOOM,
      animationDuration: 500,
      pitch: 0,
    });
    setSelectedHole(null);
  };

  const centerOnMe = () => {
    if (!userPos) return;
    cameraRef.current?.setCamera({
      centerCoordinate: userPos,
      zoomLevel: HOLE_ZOOM,
      animationDuration: 500,
    });
  };

  // Split GeoJSON for map layers
  const teeFeatures: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: geojson?.features.filter((f) => f.properties?.type === "tee") ?? [],
  };
  const basketFeatures: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: geojson?.features.filter((f) => f.properties?.type === "basket") ?? [],
  };
  const fairwayFeatures: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: geojson?.features.filter((f) => f.properties?.type === "fairway") ?? [],
  };
  const obFeatures: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: geojson?.features.filter((f) => f.properties?.type === "ob_zone") ?? [],
  };

  // Highlight selected hole's fairway
  const selectedFairway: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: selectedHole
      ? geojson?.features.filter(
          (f) => f.properties?.type === "fairway" && f.properties?.hole_number === selectedHole
        ) ?? []
      : [],
  };

  const handleFeaturePress = (event: any) => {
    const feature = event?.features?.[0];
    if (feature?.properties?.hole_number) {
      selectHole(feature.properties.hole_number);
    }
  };

  // --- Fallback screens ---

  if (Platform.OS === "web" || !MapView) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="map-outline" size={48} color={colors.gray[400]} />
          <Text style={styles.errorTitle}>Course Map</Text>
          <Text style={styles.errorText}>
            Native maps are not available in the web browser.{"\n"}
            Use the mobile app for the full satellite course map experience.
          </Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!MAPBOX_TOKEN) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="map-outline" size={48} color={colors.gray[400]} />
          <Text style={styles.errorTitle}>Mapbox Token Required</Text>
          <Text style={styles.errorText}>
            Set EXPO_PUBLIC_MAPBOX_TOKEN in your .env file.
          </Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.gray[900] }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: "#FFF" }]}>Loading course map...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const center = (geojson as any)?.properties?.center ?? DEFAULT_CENTER;

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        styleURL={
          mapStyle === "satellite"
            ? Mapbox.StyleURL.SatelliteStreet
            : Mapbox.StyleURL.Street
        }
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: center, zoomLevel: DEFAULT_ZOOM }}
        />

        <UserLocation visible animated />

        {/* Fairway lines (dimmed) */}
        {fairwayFeatures.features.length > 0 && (
          <ShapeSource id="fairways" shape={fairwayFeatures}>
            <LineLayer
              id="fairway-lines"
              style={{
                lineColor: "#FFFFFF",
                lineWidth: 2,
                lineOpacity: 0.4,
                lineDasharray: [2, 1],
              }}
            />
          </ShapeSource>
        )}

        {/* Selected hole fairway (bright) */}
        {selectedFairway.features.length > 0 && (
          <ShapeSource id="selected-fairway" shape={selectedFairway}>
            <LineLayer
              id="selected-fairway-line"
              style={{
                lineColor: "#FFD700",
                lineWidth: 4,
                lineOpacity: 1,
              }}
            />
          </ShapeSource>
        )}

        {/* OB zones */}
        {obFeatures.features.length > 0 && (
          <ShapeSource id="ob-zones" shape={obFeatures}>
            <FillLayer
              id="ob-fill"
              style={{
                fillColor: "rgba(244, 67, 54, 0.2)",
                fillOutlineColor: "#F44336",
              }}
            />
          </ShapeSource>
        )}

        {/* Tee pads */}
        {teeFeatures.features.length > 0 && (
          <ShapeSource id="tees" shape={teeFeatures} onPress={handleFeaturePress}>
            <CircleLayer
              id="tee-circles"
              style={{
                circleRadius: ["case", ["==", ["get", "hole_number"], selectedHole ?? -1], 12, 8],
                circleColor: ["case", ["==", ["get", "hole_number"], selectedHole ?? -1], "#FFD700", colors.primary],
                circleStrokeColor: "#FFFFFF",
                circleStrokeWidth: 2,
              }}
            />
            <SymbolLayer
              id="tee-labels"
              style={{
                textField: ["to-string", ["get", "hole_number"]],
                textSize: 11,
                textColor: "#FFFFFF",
                textHaloColor: ["case", ["==", ["get", "hole_number"], selectedHole ?? -1], "#FFD700", colors.primary],
                textHaloWidth: 1.5,
                textOffset: [0, -1.8],
                textFont: ["DIN Pro Bold", "Arial Unicode MS Bold"],
                textAllowOverlap: true,
              }}
            />
          </ShapeSource>
        )}

        {/* Baskets */}
        {basketFeatures.features.length > 0 && (
          <ShapeSource id="baskets" shape={basketFeatures} onPress={handleFeaturePress}>
            <CircleLayer
              id="basket-circles"
              style={{
                circleRadius: ["case", ["==", ["get", "hole_number"], selectedHole ?? -1], 9, 5],
                circleColor: ["case", ["==", ["get", "hole_number"], selectedHole ?? -1], colors.secondary, "#FF8A5B"],
                circleStrokeColor: "#FFFFFF",
                circleStrokeWidth: 2,
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {/* Header */}
      <SafeAreaView style={styles.headerOverlay} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>{courseName || "Course Map"}</Text>
          <Pressable onPress={() => setMapStyle((s) => s === "satellite" ? "streets" : "satellite")} hitSlop={8}>
            <Ionicons name={mapStyle === "satellite" ? "map-outline" : "earth-outline"} size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* Map Controls */}
      <View style={styles.controls}>
        <Pressable style={styles.controlBtn} onPress={centerOnCourse}>
          <Ionicons name="grid-outline" size={20} color={colors.text.primary} />
        </Pressable>
        {userPos && (
          <Pressable style={styles.controlBtn} onPress={centerOnMe}>
            <Ionicons name="navigate-outline" size={20} color={colors.accent.blue} />
          </Pressable>
        )}
      </View>

      {/* Live distance to basket */}
      {liveDistanceFt !== null && selectedHole && (
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceBadgeValue}>{liveDistanceFt}</Text>
          <Text style={styles.distanceBadgeUnit}>ft to basket</Text>
        </View>
      )}

      {/* Hole info card */}
      {currentHole && (
        <View style={styles.holeCard}>
          <View style={styles.holeCardRow}>
            <Pressable onPress={prevHole} hitSlop={12} style={styles.holeNavBtn}>
              <Ionicons name="chevron-back" size={24} color={holes[0]?.hole_number === selectedHole ? colors.gray[300] : colors.primary} />
            </Pressable>

            <View style={styles.holeCardCenter}>
              <Text style={styles.holeCardTitle}>Hole {currentHole.hole_number}</Text>
              <View style={styles.holeCardStats}>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{currentHole.par}</Text>
                  <Text style={styles.statLabel}>Par</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{currentHole.distance_ft ?? "—"}</Text>
                  <Text style={styles.statLabel}>Feet</Text>
                </View>
                {currentHole.elevation_change_ft != null && (
                  <>
                    <View style={styles.statDivider} />
                    <View style={styles.stat}>
                      <Text style={[styles.statValue, {
                        color: currentHole.elevation_change_ft < -1 ? colors.accent.blue
                          : currentHole.elevation_change_ft > 1 ? colors.error
                          : colors.text.secondary
                      }]}>
                        {currentHole.elevation_change_ft > 0 ? "+" : ""}
                        {currentHole.elevation_change_ft.toFixed(1)}
                      </Text>
                      <Text style={styles.statLabel}>
                        {currentHole.elevation_change_ft < -1 ? "Downhill" : currentHole.elevation_change_ft > 1 ? "Uphill" : "Flat"}
                      </Text>
                    </View>
                  </>
                )}
              </View>
              {/* AR buttons */}
              {currentHole.basket_coords && (
                <View style={styles.arBtnRow}>
                  <Pressable
                    style={styles.arBtn}
                    onPress={() =>
                      router.push({
                        pathname: "/ar/distance",
                        params: {
                          hole: String(currentHole.hole_number),
                          lat: String(currentHole.basket_coords![1]),
                          lng: String(currentHole.basket_coords![0]),
                          par: String(currentHole.par),
                          elev: currentHole.elevation_change_ft != null
                            ? String(currentHole.elevation_change_ft)
                            : undefined,
                        },
                      })
                    }
                  >
                    <Ionicons name="camera" size={16} color="#fff" />
                    <Text style={styles.arBtnText}>AR GPS</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.arBtn, styles.arBtnSpatial]}
                    onPress={() =>
                      router.push({
                        pathname: "/ar/spatial",
                        params: {
                          hole: String(currentHole.hole_number),
                          lat: String(currentHole.basket_coords![1]),
                          lng: String(currentHole.basket_coords![0]),
                          par: String(currentHole.par),
                          elev: currentHole.elevation_change_ft != null
                            ? String(currentHole.elevation_change_ft)
                            : undefined,
                        },
                      })
                    }
                  >
                    <Ionicons name="cube" size={16} color="#fff" />
                    <Text style={styles.arBtnText}>Spatial AR</Text>
                  </Pressable>
                </View>
              )}
            </View>

            <Pressable onPress={nextHole} hitSlop={12} style={styles.holeNavBtn}>
              <Ionicons name="chevron-forward" size={24} color={holes[holes.length - 1]?.hole_number === selectedHole ? colors.gray[300] : colors.primary} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Hole selector strip */}
      <View style={styles.holeSelectorContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.holeSelector}>
          {holes.map((h) => (
            <Pressable
              key={h.hole_number}
              onPress={() => selectHole(h.hole_number)}
              style={[
                styles.holePill,
                selectedHole === h.hole_number && styles.holePillSelected,
              ]}
            >
              <Text
                style={[
                  styles.holePillText,
                  selectedHole === h.hole_number && styles.holePillTextSelected,
                ]}
              >
                {h.hole_number === 19 ? "3A" : h.hole_number}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.bg.secondary,
  },
  loadingText: { marginTop: spacing.md, fontSize: fontSize.base },
  errorTitle: { fontSize: fontSize.xl, fontWeight: "700", color: colors.text.primary, marginTop: spacing.md },
  errorText: { fontSize: fontSize.base, color: colors.text.secondary, textAlign: "center", lineHeight: 22 },
  backBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  backBtnText: { color: "#FFFFFF", fontWeight: "600" },

  // Header
  headerOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(27, 94, 32, 0.9)",
  },
  headerTitle: { color: "#FFFFFF", fontSize: fontSize.lg, fontWeight: "700" },

  // Controls
  controls: {
    position: "absolute",
    right: spacing.md,
    top: 120,
    gap: spacing.xs,
    zIndex: 5,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },

  // Live distance badge
  distanceBadge: {
    position: "absolute",
    top: 120,
    left: spacing.md,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    zIndex: 5,
  },
  distanceBadgeValue: {
    color: "#FFD700",
    fontSize: 32,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  distanceBadgeUnit: {
    color: colors.gray[400],
    fontSize: fontSize.xs,
    fontWeight: "600",
  },

  // Hole info card
  holeCard: {
    position: "absolute",
    bottom: 80,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 5,
  },
  holeCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  holeNavBtn: {
    width: 36,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  holeCardCenter: {
    flex: 1,
    alignItems: "center",
  },
  holeCardTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text.primary,
  },
  holeCardStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  stat: { alignItems: "center" },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  statLabel: { fontSize: 10, color: colors.text.secondary, fontWeight: "600" },
  statDivider: { width: 1, height: 28, backgroundColor: colors.gray[200] },
  arBtnRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: spacing.xs,
  },
  arBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  arBtnSpatial: {
    backgroundColor: colors.accent.purple,
  },
  arBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  // Hole selector strip
  holeSelectorContainer: {
    position: "absolute",
    bottom: spacing.md,
    left: 0,
    right: 0,
    zIndex: 5,
  },
  holeSelector: {
    paddingHorizontal: spacing.md,
    gap: 6,
  },
  holePill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  holePillSelected: {
    backgroundColor: colors.secondary,
  },
  holePillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  holePillTextSelected: {
    fontWeight: "800",
  },
});
