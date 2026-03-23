/**
 * useWebCamera — WebRTC camera feed for browser AR.
 *
 * Uses navigator.mediaDevices.getUserMedia() to get a rear camera
 * video stream on iPhone Safari / mobile browsers.
 *
 * Returns a ref to attach to a <video> element and stream state.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";

interface WebCameraState {
  stream: MediaStream | null;
  error: string | null;
  ready: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useWebCamera(enabled = true): WebCameraState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !enabled) return;

    let currentStream: MediaStream | null = null;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera not supported in this browser");
          return;
        }

        // Request rear camera (environment facing)
        currentStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        setStream(currentStream);

        // Attach to video element if ref exists
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setReady(true);
          };
        }
      } catch (err) {
        if (err instanceof DOMException) {
          if (err.name === "NotAllowedError") {
            setError("Camera permission denied");
          } else if (err.name === "NotFoundError") {
            setError("No camera found");
          } else {
            setError(`Camera error: ${err.message}`);
          }
        } else {
          setError("Camera unavailable");
        }
      }
    })();

    return () => {
      currentStream?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled]);

  // Re-attach stream when videoRef gets mounted
  const attachStream = useCallback(() => {
    if (stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
        setReady(true);
      };
    }
  }, [stream]);

  useEffect(() => {
    attachStream();
  }, [attachStream]);

  return { stream, error, ready, videoRef };
}

/**
 * useWebFrontCamera — Front-facing camera for stance guide on web.
 */
export function useWebFrontCamera(enabled = true): WebCameraState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !enabled) return;

    let currentStream: MediaStream | null = null;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("Camera not supported");
          return;
        }

        currentStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });

        setStream(currentStream);

        if (videoRef.current) {
          videoRef.current.srcObject = currentStream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setReady(true);
          };
        }
      } catch {
        setError("Camera unavailable");
      }
    })();

    return () => {
      currentStream?.getTracks().forEach((t) => t.stop());
    };
  }, [enabled]);

  return { stream, error, ready, videoRef };
}
