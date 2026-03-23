/**
 * CameraBackground — Cross-platform camera feed for AR overlays.
 *
 * - Native: Uses expo-camera CameraView
 * - Web: Uses WebRTC getUserMedia with a <video> element
 * - Fallback: Dark background with message when camera unavailable
 */

import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Platform, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface CameraBackgroundProps {
  facing?: "front" | "back";
  children?: React.ReactNode;
}

export default function CameraBackground({
  facing = "back",
  children,
}: CameraBackgroundProps) {
  if (Platform.OS === "web") {
    return (
      <WebCameraBackground facing={facing}>{children}</WebCameraBackground>
    );
  }
  return (
    <NativeCameraBackground facing={facing}>{children}</NativeCameraBackground>
  );
}

/** Native camera using expo-camera */
function NativeCameraBackground({
  facing,
  children,
}: CameraBackgroundProps) {
  const [CameraView, setCameraView] = useState<any>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const mod = await import("expo-camera");
        const { status } = await mod.Camera.requestCameraPermissionsAsync();
        if (status !== "granted") {
          setDenied(true);
          return;
        }
        setCameraView(() => mod.CameraView);
      } catch {
        // Camera not available
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      {CameraView && !denied ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={facing === "front" ? "front" : "back"}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]}>
          {denied && (
            <View style={styles.deniedBanner}>
              <Ionicons name="camera-outline" size={24} color="#F44336" />
              <Text style={styles.deniedText}>
                Camera permission denied. AR overlay still works with GPS data.
              </Text>
            </View>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

/** Web camera using getUserMedia */
function WebCameraBackground({
  facing,
  children,
}: CameraBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera not supported in this browser");
          return;
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing === "front" ? "user" : { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
          };
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setError("Camera permission denied. Tap to retry.");
        } else {
          setError("Camera unavailable");
        }
      }
    })();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  return (
    <View style={styles.container}>
      {!error ? (
        // @ts-ignore — video element only exists on web/React DOM
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallback]}>
          <View style={styles.deniedBanner}>
            <Ionicons name="camera-outline" size={24} color="#F44336" />
            <Text style={styles.deniedText}>{error}</Text>
          </View>
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  fallback: {
    backgroundColor: "#1a1a1a",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 180,
  },
  deniedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: 300,
  },
  deniedText: {
    color: "#ccc",
    fontSize: 13,
    flex: 1,
  },
});
