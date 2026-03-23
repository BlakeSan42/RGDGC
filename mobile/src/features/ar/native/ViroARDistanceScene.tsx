/**
 * ViroARDistanceScene — Native ARKit/ARCore scene with plane detection.
 *
 * Places C1/C2 rings on detected ground planes, measures distance
 * between user-tapped points, and overlays putting probability.
 *
 * Requires: @reactvision/react-viro (EAS build, no Expo Go)
 */

import React, { useState, useCallback, useRef } from "react";
import {
  ViroARScene,
  ViroText,
  ViroNode,
  ViroFlexView,
  ViroMaterials,
  Viro3DObject,
  ViroAmbientLight,
  ViroSpotLight,
  ViroARPlane,
  ViroARPlaneSelector,
  ViroQuad,
} from "@reactvision/react-viro";
import {
  estimatePuttProb,
  formatProb,
  C1_METERS,
  C2_METERS,
  SKILL_LEVELS,
  type SkillParams,
} from "../arUtils";

interface ViroARDistanceSceneProps {
  skillLevel?: string;
  windSpeedMph?: number;
  elevationChangeFt?: number;
  onDistanceUpdate?: (distanceM: number) => void;
  onPlaneDetected?: () => void;
}

// Register materials for rings and markers
ViroMaterials.createMaterials({
  c1Ring: {
    diffuseColor: "rgba(76, 175, 80, 0.3)",
    lightingModel: "Constant",
  },
  c1RingBorder: {
    diffuseColor: "rgba(76, 175, 80, 0.8)",
    lightingModel: "Constant",
  },
  c2Ring: {
    diffuseColor: "rgba(255, 193, 7, 0.2)",
    lightingModel: "Constant",
  },
  c2RingBorder: {
    diffuseColor: "rgba(255, 193, 7, 0.6)",
    lightingModel: "Constant",
  },
  basketMarker: {
    diffuseColor: "rgba(255, 107, 53, 0.9)",
    lightingModel: "Constant",
  },
  playerMarker: {
    diffuseColor: "rgba(33, 150, 243, 0.9)",
    lightingModel: "Constant",
  },
  distanceLine: {
    diffuseColor: "rgba(255, 255, 255, 0.6)",
    lightingModel: "Constant",
  },
  groundPlane: {
    diffuseColor: "rgba(255, 255, 255, 0.05)",
    lightingModel: "Constant",
  },
});

interface AnchorPoint {
  position: [number, number, number];
  label: string;
}

export default function ViroARDistanceScene({
  skillLevel = "intermediate",
  windSpeedMph = 0,
  elevationChangeFt = 0,
  onDistanceUpdate,
  onPlaneDetected,
}: ViroARDistanceSceneProps) {
  const [basketPoint, setBasketPoint] = useState<AnchorPoint | null>(null);
  const [playerPoint, setPlayerPoint] = useState<AnchorPoint | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [planeFound, setPlaneFound] = useState(false);
  const tapMode = useRef<"basket" | "player">("basket");

  const params: SkillParams = SKILL_LEVELS[skillLevel] || SKILL_LEVELS.intermediate;

  // Calculate 3D distance between two points
  const calcDistance = useCallback(
    (a: [number, number, number], b: [number, number, number]) => {
      const dx = a[0] - b[0];
      const dy = a[1] - b[1];
      const dz = a[2] - b[2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },
    [],
  );

  // Handle AR hit test (tap on detected plane)
  const onARHitTest = useCallback(
    (results: any) => {
      if (!results || results.length === 0) return;

      // Use the first hit result on a detected plane
      const hit = results[0];
      const pos: [number, number, number] = [
        hit.transform.position[0],
        hit.transform.position[1],
        hit.transform.position[2],
      ];

      if (tapMode.current === "basket") {
        setBasketPoint({ position: pos, label: "Basket" });
        tapMode.current = "player";
      } else {
        setPlayerPoint({ position: pos, label: "You" });
        tapMode.current = "basket";

        // Calculate distance
        if (basketPoint) {
          const dist = calcDistance(basketPoint.position, pos);
          setDistance(dist);
          onDistanceUpdate?.(dist);
        }
      }
    },
    [basketPoint, calcDistance, onDistanceUpdate],
  );

  const handlePlaneSelected = useCallback(
    (anchor: any) => {
      setPlaneFound(true);
      onPlaneDetected?.();
    },
    [onPlaneDetected],
  );

  // Putting probability
  const prob =
    distance != null
      ? estimatePuttProb(distance, params, windSpeedMph, elevationChangeFt)
      : null;

  // C1/C2 ring scale (real-world meters)
  const c1Diameter = C1_METERS * 2; // 20m diameter
  const c2Diameter = C2_METERS * 2; // 40m diameter

  return (
    <ViroARScene
      onTrackingUpdated={() => {}}
      anchorDetectionTypes={["PlanesHorizontal"]}
    >
      <ViroAmbientLight color="#ffffff" intensity={200} />

      {/* Instruction text */}
      {!basketPoint && (
        <ViroText
          text="Tap the ground at the basket location"
          position={[0, 0, -2]}
          scale={[0.5, 0.5, 0.5]}
          style={{
            fontSize: 20,
            color: "#ffffff",
            textAlignVertical: "center",
            textAlign: "center",
            fontWeight: "bold",
          }}
        />
      )}

      {basketPoint && !playerPoint && (
        <ViroText
          text="Now tap where you're standing"
          position={[0, 0, -2]}
          scale={[0.5, 0.5, 0.5]}
          style={{
            fontSize: 20,
            color: "#ffffff",
            textAlignVertical: "center",
            textAlign: "center",
            fontWeight: "bold",
          }}
        />
      )}

      {/* Plane selector for initial detection */}
      {!planeFound && (
        <ViroARPlaneSelector
          alignment="Horizontal"
          onPlaneSelected={handlePlaneSelected}
        />
      )}

      {/* Basket marker */}
      {basketPoint && (
        <ViroNode position={basketPoint.position}>
          {/* Basket pole */}
          <ViroQuad
            position={[0, 0.005, 0]}
            rotation={[-90, 0, 0]}
            width={0.3}
            height={0.3}
            materials={["basketMarker"]}
          />

          {/* C1 ring on ground */}
          <ViroNode position={[0, 0.002, 0]} rotation={[-90, 0, 0]}>
            {/* C1 fill */}
            <ViroQuad
              width={c1Diameter}
              height={c1Diameter}
              materials={["c1Ring"]}
            />
          </ViroNode>

          {/* C2 ring on ground */}
          <ViroNode position={[0, 0.001, 0]} rotation={[-90, 0, 0]}>
            <ViroQuad
              width={c2Diameter}
              height={c2Diameter}
              materials={["c2Ring"]}
            />
          </ViroNode>

          {/* C1 label */}
          <ViroText
            text="C1 (10m)"
            position={[C1_METERS, 0.5, 0]}
            scale={[0.3, 0.3, 0.3]}
            style={{
              fontSize: 14,
              color: "#4CAF50",
              fontWeight: "bold",
            }}
          />

          {/* C2 label */}
          <ViroText
            text="C2 (20m)"
            position={[C2_METERS, 0.5, 0]}
            scale={[0.3, 0.3, 0.3]}
            style={{
              fontSize: 14,
              color: "#FFC107",
              fontWeight: "bold",
            }}
          />
        </ViroNode>
      )}

      {/* Player marker */}
      {playerPoint && (
        <ViroNode position={playerPoint.position}>
          <ViroQuad
            position={[0, 0.005, 0]}
            rotation={[-90, 0, 0]}
            width={0.2}
            height={0.2}
            materials={["playerMarker"]}
          />
        </ViroNode>
      )}

      {/* Distance display */}
      {distance != null && basketPoint && playerPoint && (
        <ViroNode
          position={[
            (basketPoint.position[0] + playerPoint.position[0]) / 2,
            Math.max(basketPoint.position[1], playerPoint.position[1]) + 0.8,
            (basketPoint.position[2] + playerPoint.position[2]) / 2,
          ]}
        >
          {/* Distance text */}
          <ViroText
            text={`${(distance / 0.3048).toFixed(0)} ft (${distance.toFixed(1)}m)`}
            scale={[0.4, 0.4, 0.4]}
            style={{
              fontSize: 24,
              color: "#ffffff",
              fontWeight: "bold",
              textAlign: "center",
            }}
          />

          {/* Probability text */}
          {prob != null && distance <= C2_METERS && (
            <ViroText
              text={`Make: ${formatProb(prob)}`}
              position={[0, -0.3, 0]}
              scale={[0.35, 0.35, 0.35]}
              style={{
                fontSize: 20,
                color: prob >= 0.5 ? "#4CAF50" : prob >= 0.2 ? "#FFC107" : "#F44336",
                fontWeight: "bold",
                textAlign: "center",
              }}
            />
          )}

          {/* Zone label */}
          <ViroText
            text={
              distance <= C1_METERS
                ? "Inside C1"
                : distance <= C2_METERS
                  ? "Circle 2"
                  : "Outside C2"
            }
            position={[0, -0.55, 0]}
            scale={[0.25, 0.25, 0.25]}
            style={{
              fontSize: 16,
              color:
                distance <= C1_METERS
                  ? "#4CAF50"
                  : distance <= C2_METERS
                    ? "#FFC107"
                    : "#F44336",
              textAlign: "center",
            }}
          />
        </ViroNode>
      )}

      {/* Distance line between points */}
      {basketPoint && playerPoint && (
        <ViroNode>
          <ViroQuad
            position={[
              (basketPoint.position[0] + playerPoint.position[0]) / 2,
              (basketPoint.position[1] + playerPoint.position[1]) / 2 + 0.01,
              (basketPoint.position[2] + playerPoint.position[2]) / 2,
            ]}
            rotation={[-90, 0, 0]}
            width={0.05}
            height={distance ?? 1}
            materials={["distanceLine"]}
          />
        </ViroNode>
      )}
    </ViroARScene>
  );
}
