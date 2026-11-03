'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Video,
  VideoOff,
  Minimize2,
  Maximize2,
  Eye,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Users,
  ShieldAlert,
} from 'lucide-react';
import {
  RawFaceDetection,
  analyzeVideoFrame,
  CameraProctoringTracker,
  estimateLookAwayDirection,
} from '@/lib/services/cameraProctoringService';
import { CameraIntegrityEvent, LookAwayDirection } from '@/types';

interface CameraPreviewOverlayProps {
  stream: MediaStream | null;
  tracker: CameraProctoringTracker | null;
  onEventGenerated?: (event: CameraIntegrityEvent) => void;
  onDetectionUpdate?: (detection: RawFaceDetection, dir: LookAwayDirection) => void;
  questionContext?: { id: string; position: number };
  isExamActive: boolean;
}

export function CameraPreviewOverlay({
  stream,
  tracker,
  onEventGenerated,
  onDetectionUpdate,
  questionContext,
  isExamActive,
}: CameraPreviewOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [detection, setDetection] = useState<RawFaceDetection>({
    faceDetected: true,
    faceCount: 1,
    confidence: 0.9,
  });
  const [estimatedDir, setEstimatedDir] = useState<LookAwayDirection>('forward');

  // Attach MediaStream to Video Element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current
        .play()
        .catch((err) => console.warn('[CameraOverlay] Autoplay interrupted:', err));
    }
  }, [stream]);

  // Periodic frame sampling across whole area (twice per second)
  useEffect(() => {
    if (!isExamActive || !stream || !tracker) return;

    const intervalId = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;

      const raw = analyzeVideoFrame(videoRef.current, canvasRef.current);
      setDetection(raw);

      let dir: LookAwayDirection = 'forward';
      if (raw.faceDetected) {
        dir = estimateLookAwayDirection(raw.yawOffset, raw.pitchOffset);
      } else {
        dir = 'uncertain';
      }
      setEstimatedDir(dir);

      if (onDetectionUpdate) {
        onDetectionUpdate(raw, dir);
      }

      const event = tracker.processFrame(raw, questionContext);
      if (event && onEventGenerated) {
        onEventGenerated(event);
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [isExamActive, stream, tracker, questionContext, onEventGenerated, onDetectionUpdate]);

  const isFacePresent = detection.faceDetected && detection.faceCount > 0;
  const isMultiFace = detection.faceCount > 1;
  const isLookAway = isFacePresent && estimatedDir !== 'forward' && estimatedDir !== 'uncertain';

  if (!stream) {
    return (
      <div className="fixed top-20 right-4 z-40 p-2.5 rounded-xl bg-surface-800/95 border border-amber-500/40 backdrop-blur-md shadow-2xl text-xs text-amber-300 flex items-center gap-2">
        <VideoOff size={14} className="text-amber-400" />
        <span className="font-semibold text-[11px]">Camera Inactive</span>
      </div>
    );
  }

  // Calculate box coordinates normalized to percentage for responsive SVG overlay
  const boxPercent = detection.box
    ? {
        left: `${Math.max(0, Math.min(80, (1 - (detection.box.x + detection.box.width) / 160) * 100))}%`,
        top: `${Math.max(0, Math.min(80, (detection.box.y / 120) * 100))}%`,
        width: `${Math.max(20, Math.min(100, (detection.box.width / 160) * 100))}%`,
        height: `${Math.max(20, Math.min(100, (detection.box.height / 120) * 100))}%`,
      }
    : null;

  return (
    <aside
      aria-label="Proctoring Camera Feed"
      className={`fixed top-16 sm:top-20 right-3 sm:right-6 z-40 transition-all duration-300 ${
        isMinimized ? 'w-auto' : 'w-48 sm:w-56'
      }`}
    >
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Floating Window Container */}
      <div
        className={`rounded-2xl overflow-hidden bg-surface-900/95 backdrop-blur-md shadow-2xl ring-1 transition-colors duration-300 ${
          isMultiFace
            ? 'border-2 border-rose-500 ring-rose-500/30'
            : !isFacePresent
            ? 'border-2 border-amber-500 ring-amber-500/30'
            : isLookAway
            ? 'border-2 border-sky-500 ring-sky-500/30'
            : 'border border-indigo-500/30 ring-white/10'
        }`}
      >
        {/* Header Bar */}
        <div className="px-2.5 py-1.5 bg-surface-800/90 border-b border-border/60 flex items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isMultiFace
                  ? 'bg-rose-500 animate-ping'
                  : !isFacePresent
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider font-mono">
              Proctoring Cam
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              aria-label={isMinimized ? 'Expand Camera Feed' : 'Minimize Camera Feed'}
              className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-700 transition-colors cursor-pointer"
              title={isMinimized ? 'Expand Camera Preview' : 'Minimize Camera Preview'}
            >
              {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
            </button>
          </div>
        </div>

        {/* Video Frame Body */}
        {!isMinimized && (
          <div className="relative aspect-[4/3] bg-black overflow-hidden group">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Dynamic Real-Time Bounding Box Target (Whole Area Scanner) */}
            {isFacePresent && boxPercent ? (
              <div
                className={`absolute pointer-events-none transition-all duration-200 border-2 rounded-xl ${
                  isMultiFace
                    ? 'border-rose-400 bg-rose-500/15'
                    : isLookAway
                    ? 'border-sky-400 bg-sky-500/10'
                    : 'border-emerald-400/80 bg-emerald-500/5'
                }`}
                style={{
                  left: boxPercent.left,
                  top: boxPercent.top,
                  width: boxPercent.width,
                  height: boxPercent.height,
                }}
              >
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white" />
                <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white" />
                <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white" />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white" />
              </div>
            ) : (
              /* Center Guide Fallback when face missing */
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-amber-400/80 bg-amber-500/15 animate-pulse flex items-center justify-center">
                  <span className="text-[9px] font-bold text-amber-200 text-center px-1">
                    Align Face in Frame
                  </span>
                </div>
              </div>
            )}

            {/* Live Status Warning Banner Overlay */}
            <div className="absolute top-1.5 left-1.5 right-1.5 pointer-events-none">
              {isMultiFace && (
                <div className="px-2 py-0.5 rounded-md bg-rose-950/90 text-rose-300 border border-rose-500/50 backdrop-blur-md text-[9px] font-bold flex items-center gap-1 shadow-lg animate-bounce">
                  <Users size={11} className="text-rose-400" />
                  <span>2+ Faces in View!</span>
                </div>
              )}
              {!isFacePresent && (
                <div className="px-2 py-0.5 rounded-md bg-amber-950/90 text-amber-300 border border-amber-500/50 backdrop-blur-md text-[9px] font-bold flex items-center gap-1 shadow-lg animate-pulse">
                  <AlertTriangle size={11} className="text-amber-400" />
                  <span>No Face Detected</span>
                </div>
              )}
            </div>

            {/* Bottom Indicator Pill */}
            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none text-[9px] font-mono">
              <span
                className={`px-1.5 py-0.5 rounded backdrop-blur-md font-bold flex items-center gap-1 ${
                  isMultiFace
                    ? 'bg-rose-950/90 text-rose-300 border border-rose-500/40'
                    : isFacePresent
                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-950/90 text-amber-300 border border-amber-500/40'
                }`}
              >
                {isMultiFace ? (
                  <>
                    <Users size={10} />
                    Multi-Face
                  </>
                ) : isFacePresent ? (
                  <>
                    <CheckCircle2 size={10} />
                    Face Active
                  </>
                ) : (
                  <>
                    <AlertTriangle size={10} />
                    Face Missing
                  </>
                )}
              </span>

              {isFacePresent && (
                <span
                  className={`px-1.5 py-0.5 rounded backdrop-blur-md capitalize font-bold ${
                    isLookAway
                      ? 'bg-sky-950/90 text-sky-300 border border-sky-500/40'
                      : 'bg-surface-900/80 text-text-muted border border-border/60'
                  }`}
                >
                  {isLookAway ? `Look: ${estimatedDir}` : 'Look: Forward'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Minimized Pill Bar */}
        {isMinimized && (
          <div
            className={`px-2.5 py-1 text-[10px] flex items-center gap-1.5 ${
              isMultiFace
                ? 'bg-rose-950/90 text-rose-300 font-bold'
                : !isFacePresent
                ? 'bg-amber-950/90 text-amber-300 font-bold'
                : 'text-text-muted'
            }`}
          >
            <Camera size={11} className={isMultiFace ? 'text-rose-400' : isFacePresent ? 'text-indigo-400' : 'text-amber-400'} />
            <span className="text-[10px] font-medium">
              {isMultiFace
                ? '2+ Faces Detected'
                : isFacePresent
                ? isLookAway
                  ? `Look: ${estimatedDir}`
                  : 'Face Verified'
                : 'Face Not Detected'}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
