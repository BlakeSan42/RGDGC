import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { geoApi } from "@/services/api";
import { colors, spacing, fontSize, borderRadius } from "@/constants/theme";

// Mapbox is native-only — lazy import to avoid crash on web
let Mapbox: any = null;
let MapView: any = null;
let Camera: any = null;
let ShapeSource: any = null;
let SymbolLayer: any = null;
let LineLayer: any = null;
let CircleLayer: any = null;
let Images: any = null;
let UserLocation: any = null;

if (Platform.OS !== "web") {
  const maps = require("@rnmapbox/maps");
  Mapbox = maps.default;
  MapView = maps.MapView;
  Camera = maps.Camera;
  ShapeSource = maps.ShapeSource;
  SymbolLayer = maps.SymbolLayer;
  LineLayer = maps.LineLayer;
  CircleLayer = maps.CircleLayer;
  Images = maps.Images;
  UserLocation = maps.UserLocation;

  const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "";
  Mapbox.setAccessToken(MAPBOX_TOKEN);
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "";

// River Grove DGC center (Kingwood, TX)
const DEFAULT_CENTER: [number, number] = [-95.208576, 30.027066];
const DEFAULT_ZOOM = 16.5;

interface HoleInfo {
  hole_number: number;
  par: number;
  distance_ft: number | null;
  type: string;
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
  const [selectedHole, setSelectedHole] = useState<HoleInfo | null>(null);
  const [mapStyle, setMapStyle] = useState<"satellite" | "streets">("satellite");
  const cameraRef = useRef<InstanceType<typeof Camera>>(null);

  useEffect(() => {
    if (!courseId) return;
    geoApi
      .courseGeoJSON(Number(courseId), layoutId ? Number(layoutId) : undefined)
      .then((data) => {
        setGeojson(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [courseId, layoutId]);

  // Split GeoJSON into separate sources for styling
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

  const handleTeePress = (event: any) => {
    const feature = event?.features?.[0];
    if (feature?.properties) {
      setSelectedHole({
        hole_number: feature.properties.hole_number,
        par: feature.properties.par,
        distance_ft: feature.properties.distance_ft,
        type: "tee",
      });
    }
  };

  const handleBasketPress = (event: any) => {
    const feature = event?.features?.[0];
    if (feature?.properties) {
      setSelectedHole({
        hole_number: feature.properties.hole_number,
        par: feature.properties.par,
        distance_ft: null,
        type: "basket",
      });
    }
  };

  const toggleMapStyle = () => {
    setMapStyle((prev) => (prev === "satellite" ? "streets" : "satellite"));
  };

  const centerOnCourse = () => {
    const center = (geojson as any)?.properties?.center ?? DEFAULT_CENTER;
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel: DEFAULT_ZOOM,
      animationDuration: 500,
    });
  };

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
            Set EXPO_PUBLIC_MAPBOX_TOKEN in your .env file.{"\n"}
            Get a free token at mapbox.com (50k loads/month free).
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
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading course map...</Text>
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
          defaultSettings={{
            centerCoordinate: center,
            zoomLevel: DEFAULT_ZOOM,
          }}
        />

        <UserLocation visible animated />

        {/* Fairway lines */}
        {fairwayFeatures.features.length > 0 && (
          <ShapeSource id="fairways" shape={fairwayFeatures}>
            <LineLayer
              id="fairway-lines"
              style={{
                lineColor: "#FFFFFF",
                lineWidth: 2.5,
                lineOpacity: 0.8,
                lineDasharray: [2, 1],
              }}
            />
          </ShapeSource>
        )}

        {/* OB zones */}
        {obFeatures.features.length > 0 && (
          <ShapeSource id="ob-zones" shape={obFeatures}>
            <LineLayer
              id="ob-lines"
              style={{
                lineColor: "#F44336",
                lineWidth: 2,
                lineOpacity: 0.9,
              }}
            />
          </ShapeSource>
        )}

        {/* Tee pads */}
        {teeFeatures.features.length > 0 && (
          <ShapeSource
            id="tees"
            shape={teeFeatures}
            onPress={handleTeePress}
          >
            <CircleLayer
              id="tee-circles"
              style={{
                circleRadius: 8,
                circleColor: colors.primary,
                circleStrokeColor: "#FFFFFF",
                circleStrokeWidth: 2,
              }}
            />
            <SymbolLayer
              id="tee-labels"
              style={{
                textField: ["get", "hole_number"],
                textSize: 11,
                textColor: "#FFFFFF",
                textHaloColor: colors.primary,
                textHaloWidth: 1.5,
                textOffset: [0, -1.5],
                textFont: ["DIN Pro Bold", "Arial Unicode MS Bold"],
              }}
            />
          </ShapeSource>
        )}

        {/* Baskets */}
        {basketFeatures.features.length > 0 && (
          <ShapeSource
            id="baskets"
            shape={basketFeatures}
            onPress={handleBasketPress}
          >
            <CircleLayer
              id="basket-circles"
              style={{
                circleRadius: 6,
                circleColor: colors.secondary,
                circleStrokeColor: "#FFFFFF",
                circleStrokeWidth: 2,
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {/* Map Controls */}
      <View style={styles.controls}>
        <Pressable style={styles.controlBtn} onPress={toggleMapStyle}>
          <Ionicons
            name={mapStyle === "satellite" ? "map-outline" : "earth-outline"}
            size={22}
            color={colors.text.primary}
          />
        </Pressable>
        <Pressable style={styles.controlBtn} onPress={centerOnCourse}>
          <Ionicons name="locate-outline" size={22} color={colors.text.primary} />
        </Pressable>
      </View>

      {/* Header overlay */}
      <SafeAreaView style={styles.headerOverlay} edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>
            {courseName || "Course Map"}
          </Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>

      {/* Hole info card */}
      {selectedHole && (
        <View style={styles.holeCard}>
          <View style={styles.holeCardHeader}>
            <Text style={styles.holeCardTitle}>
              Hole {selectedHole.hole_number}
            </Text>
            <Pressable onPress={() => setSelectedHole(null)} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.gray[500]} />
            </Pressable>
          </View>
          <View style={styles.holeCardStats}>
            <View style={styles.holeCardStat}>
              <Text style={styles.holeCardStatValue}>
                {selectedHole.par}
              </Text>
              <Text style={styles.holeCardStatLabel}>Par</Text>
            </View>
            {selectedHole.distance_ft && (
              <View style={styles.holeCardStat}>
                <Text style={styles.holeCardStatValue}>
                  {selectedHole.distance_ft}
                </Text>
                <Text style={styles.holeCardStatLabel}>Feet</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Feature count badge */}
      <View style={styles.featureCount}>
        <Text style={styles.featureCountText}>
          {teeFeatures.features.length} holes mapped
        </Text>
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
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.base,
    color: colors.text.secondary,
  },
  errorTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text.primary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  // Header
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: "rgba(27, 94, 32, 0.85)",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: fontSize.lg,
    fontWeight: "700",
  },

  // Controls
  controls: {
    position: "absolute",
    right: spacing.md,
    top: 120,
    gap: spacing.xs,
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

  // Hole info card
  holeCard: {
    position: "absolute",
    bottom: spacing.xl + 40,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: "#FFFFFF",
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  holeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  holeCardTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text.primary,
  },
  holeCardStats: {
    flexDirection: "row",
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  holeCardStat: {
    alignItems: "center",
  },
  holeCardStatValue: {
    fontSize: fontSize["2xl"],
    fontWeight: "700",
    color: colors.primary,
  },
  holeCardStatLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
  },

  // Feature count
  featureCount: {
    position: "absolute",
    bottom: spacing.md,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  featureCountText: {
    color: "#FFFFFF",
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
});
