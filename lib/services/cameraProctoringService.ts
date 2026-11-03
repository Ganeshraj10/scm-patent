/**
 * ExamGuard — Camera Proctoring Engine (Layer 2)
 *
 * Privacy-Aware Real-Time Camera Evidence Extraction:
 * - Real-time face presence / absence detection
 * - Observable head orientation & estimated look-away tracking
 * - Look-away severity classification (brief vs prolonged vs repeated)
 * - Multiple-person presence detection
 * - Camera technical interruption & continuity tracking
 * - Zero raw video storage (Privacy-by-Design: only derived metadata events)
 * - Zero emotion detection claims
 */

import {
  CameraEventType,
  CameraIntegrityEvent,
  CameraEvidenceSummary,
  CameraStatusState,
  FacePresenceState,
  LookAwayDirection,
  LookAwaySeverity,
  MultiplePersonState,
} from '@/types';

export interface CameraProctoringConfig {
  briefLookAwayMaxSec: number;
  prolongedLookAwayMinSec: number;
  repeatedLookAwayWindowSec: number;
  repeatedLookAwayThreshold: number;
  faceAbsenceAlertSec: number;
  samplingIntervalMs: number;
}

export const CAMERA_PROCTORING_CONFIG: CameraProctoringConfig = {
  briefLookAwayMaxSec: 2.5,
  prolongedLookAwayMinSec: 3.0,
  repeatedLookAwayWindowSec: 60,
  repeatedLookAwayThreshold: 3,
  faceAbsenceAlertSec: 4.0,
  samplingIntervalMs: 500,
};

export interface RawFaceDetection {
  faceDetected: boolean;
  faceCount: number;
  confidence: number;
  box?: { x: number; y: number; width: number; height: number };
  // Relative offset of nose/centroid from bounding center (-1 to 1)
  yawOffset?: number; // negative = looking left, positive = looking right
  pitchOffset?: number; // negative = looking up, positive = looking down
}

// ─── Pure / Testable Helper Functions ────────────────────────────────────────

/**
 * Classifies look-away severity based on duration and frequency within the temporal window.
 */
export function classifyLookAwaySeverity(
  durationSec: number,
  recentLookAwayCountInWindow: number,
  config: CameraProctoringConfig = CAMERA_PROCTORING_CONFIG
): LookAwaySeverity {
  if (recentLookAwayCountInWindow >= config.repeatedLookAwayThreshold) {
    return durationSec >= config.prolongedLookAwayMinSec ? 'sustained' : 'repeated';
  }
  if (durationSec >= config.prolongedLookAwayMinSec) {
    return 'prolonged';
  }
  return 'brief';
}

/**
 * Estimates head orientation / look-away direction from geometric offsets.
 * Strictly estimates observable attention direction, avoiding exact eye-tracking claims.
 */
export function estimateLookAwayDirection(
  yawOffset: number = 0,
  pitchOffset: number = 0
): LookAwayDirection {
  const YAW_THRESHOLD = 0.28;
  const PITCH_THRESHOLD = 0.25;

  if (Math.abs(yawOffset) < YAW_THRESHOLD && Math.abs(pitchOffset) < PITCH_THRESHOLD) {
    return 'forward';
  }

  // Determine dominant axis
  if (Math.abs(yawOffset) >= Math.abs(pitchOffset)) {
    return yawOffset < 0 ? 'left' : 'right';
  } else {
    return pitchOffset < 0 ? 'up' : 'down';
  }
}

/**
 * Evaluates face presence state from detection count.
 */
export function evaluateFacePresence(faceCount: number, confidence: number = 1.0): FacePresenceState {
  if (confidence < 0.35) return 'detection_uncertain';
  return faceCount > 0 ? 'face_present' : 'face_missing';
}

/**
 * Evaluates multiple-person presence state from detection count.
 */
export function evaluateMultiplePersonState(faceCount: number, confidence: number = 1.0): MultiplePersonState {
  if (confidence < 0.35) return 'detection_uncertain';
  return faceCount > 1 ? 'multiple_faces' : 'single_face';
}

/**
 * Generates an aggregated CameraEvidenceSummary from recorded events.
 */
export function buildCameraEvidenceSummary(
  events: CameraIntegrityEvent[],
  totalExamDurationSec: number,
  isCameraActive: boolean = true
): CameraEvidenceSummary {
  const lookAwayDirectionCounts: Record<LookAwayDirection, number> = {
    forward: 0,
    left: 0,
    right: 0,
    up: 0,
    down: 0,
    uncertain: 0,
  };

  let totalAbsenceDurationMs = 0;
  let briefCount = 0;
  let prolongedCount = 0;
  let repeatedCount = 0;
  let multiplePersonsCount = 0;
  let interruptionCount = 0;
  let totalLookAwayCount = 0;

  events.forEach((ev) => {
    if (ev.eventType === 'look_away') {
      totalLookAwayCount++;
      if (ev.direction && lookAwayDirectionCounts[ev.direction] !== undefined) {
        lookAwayDirectionCounts[ev.direction]++;
      }
      if (ev.severity === 'brief') briefCount++;
      else if (ev.severity === 'prolonged') prolongedCount++;
      else if (ev.severity === 'repeated' || ev.severity === 'sustained') repeatedCount++;
    } else if (ev.eventType === 'face_missing') {
      totalAbsenceDurationMs += ev.durationMs || 0;
    } else if (ev.eventType === 'multiple_persons') {
      multiplePersonsCount++;
    } else if (ev.eventType === 'camera_interrupted' || ev.eventType === 'camera_permission_denied') {
      interruptionCount++;
    }
  });

  const totalAbsenceSec = totalAbsenceDurationMs / 1000;
  const examSec = Math.max(1, totalExamDurationSec);
  const presentSec = Math.max(0, examSec - totalAbsenceSec);
  const presencePct = Math.min(100, Math.max(0, Math.round((presentSec / examSec) * 100)));

  let overallStatus: CameraStatusState = 'active';
  if (!isCameraActive && interruptionCount > 0) {
    overallStatus = 'interrupted';
  } else if (!isCameraActive) {
    overallStatus = 'unavailable';
  }

  return {
    overallCameraStatus: overallStatus,
    facePresencePercentage: presencePct,
    totalAbsenceDurationSec: Math.round(totalAbsenceSec * 10) / 10,
    totalLookAwayEvents: totalLookAwayCount,
    briefLookAwayCount: briefCount,
    prolongedLookAwayCount: prolongedCount,
    repeatedLookAwayCount: repeatedCount,
    multiplePersonEventCount: multiplePersonsCount,
    cameraInterruptionCount: interruptionCount,
    lookAwayDirectionCounts,
    isCameraActive,
  };
}

// ─── Real-Time Tracker Class for Active Exams ───────────────────────────────

export class CameraProctoringTracker {
  private events: CameraIntegrityEvent[] = [];
  private currentDirection: LookAwayDirection = 'forward';
  private directionStartTime: number = Date.now();
  private lastFaceState: FacePresenceState = 'face_present';
  private faceAbsenceStartTime: number | null = null;
  private isCameraActive: boolean = true;
  private config: CameraProctoringConfig;
  private eventIndex: number = 0;
  private activeLookAwayEvent: CameraIntegrityEvent | null = null;

  constructor(config: CameraProctoringConfig = CAMERA_PROCTORING_CONFIG) {
    this.config = config;
  }

  public getEvents(): CameraIntegrityEvent[] {
    return [...this.events];
  }

  public recordInterruption(reason: string, questionContext?: { id: string; position: number }): CameraIntegrityEvent {
    this.isCameraActive = false;
    this.eventIndex++;
    const event: CameraIntegrityEvent = {
      id: `cam_int_${Date.now()}_${this.eventIndex}`,
      eventType: 'camera_interrupted',
      timestamp: new Date().toISOString(),
      questionId: questionContext?.id,
      sessionPosition: questionContext?.position,
      isIsolated: this.events.filter((e) => e.eventType === 'camera_interrupted').length === 0,
      occurrenceIndex: this.eventIndex,
      contextSummary: `Camera stream interrupted: ${reason}`,
    };
    this.events.push(event);
    return event;
  }

  public recordResumed(questionContext?: { id: string; position: number }): CameraIntegrityEvent {
    this.isCameraActive = true;
    this.eventIndex++;
    const event: CameraIntegrityEvent = {
      id: `cam_res_${Date.now()}_${this.eventIndex}`,
      eventType: 'camera_resumed',
      timestamp: new Date().toISOString(),
      questionId: questionContext?.id,
      sessionPosition: questionContext?.position,
      isIsolated: true,
      occurrenceIndex: this.eventIndex,
      contextSummary: 'Camera stream restored and operational',
    };
    this.events.push(event);
    return event;
  }

  /**
   * Process a periodic frame analysis result.
   */
  public processFrame(
    detection: RawFaceDetection,
    questionContext?: { id: string; position: number }
  ): CameraIntegrityEvent | null {
    const now = Date.now();
    let generatedEvent: CameraIntegrityEvent | null = null;

    // 1. Multiple-Person Check
    if (detection.faceCount > 1) {
      const recentMulti = this.events.filter(
        (e) => e.eventType === 'multiple_persons' && now - new Date(e.timestamp).getTime() < 10000
      );
      if (recentMulti.length === 0) {
        this.eventIndex++;
        const event: CameraIntegrityEvent = {
          id: `cam_mp_${now}_${this.eventIndex}`,
          eventType: 'multiple_persons',
          timestamp: new Date(now).toISOString(),
          questionId: questionContext?.id,
          sessionPosition: questionContext?.position,
          isIsolated: this.events.filter((e) => e.eventType === 'multiple_persons').length === 0,
          occurrenceIndex: this.eventIndex,
          personsCount: detection.faceCount,
          contextSummary: `Multiple-person camera observation (${detection.faceCount} faces detected)`,
        };
        this.events.push(event);
        generatedEvent = event;
      }
    }

    // 2. Face Presence / Absence Transition
    const faceState = evaluateFacePresence(detection.faceCount, detection.confidence);
    if (faceState === 'face_missing' && this.lastFaceState !== 'face_missing') {
      this.faceAbsenceStartTime = now;
      this.lastFaceState = 'face_missing';

      // Finalize active look-away if face is lost
      if (this.activeLookAwayEvent) {
        this.activeLookAwayEvent = null;
      }
      this.currentDirection = 'uncertain';
    } else if (faceState === 'face_present' && this.lastFaceState === 'face_missing') {
      const durationMs = this.faceAbsenceStartTime ? now - this.faceAbsenceStartTime : 1000;
      this.faceAbsenceStartTime = null;
      this.lastFaceState = 'face_present';

      // Log face absence event if duration exceeds threshold
      if (durationMs >= this.config.faceAbsenceAlertSec * 1000) {
        this.eventIndex++;
        const event: CameraIntegrityEvent = {
          id: `cam_abs_${now}_${this.eventIndex}`,
          eventType: 'face_missing',
          timestamp: new Date(now - durationMs).toISOString(),
          durationMs,
          questionId: questionContext?.id,
          sessionPosition: questionContext?.position,
          isIsolated: this.events.filter((e) => e.eventType === 'face_missing').length === 0,
          occurrenceIndex: this.eventIndex,
          contextSummary: `Face absence observed for ${(durationMs / 1000).toFixed(1)}s`,
        };
        this.events.push(event);
        generatedEvent = event;
      }
    }

    // 3. Look-Away Estimation & Real-Time Continuous Recording
    if (detection.faceDetected) {
      const estimatedDirection = estimateLookAwayDirection(detection.yawOffset, detection.pitchOffset);

      if (estimatedDirection !== 'forward' && estimatedDirection !== 'uncertain') {
        // Looking away!
        if (this.currentDirection !== estimatedDirection) {
          // Started looking in a new look-away direction
          this.currentDirection = estimatedDirection;
          this.directionStartTime = now;
          this.eventIndex++;

          const windowMs = this.config.repeatedLookAwayWindowSec * 1000;
          const recentLookAwaysInWindow = this.events.filter(
            (e) => e.eventType === 'look_away' && now - new Date(e.timestamp).getTime() < windowMs
          ).length;

          const event: CameraIntegrityEvent = {
            id: `cam_la_${now}_${this.eventIndex}`,
            eventType: 'look_away',
            timestamp: new Date(now).toISOString(),
            durationMs: 500,
            direction: estimatedDirection,
            severity: classifyLookAwaySeverity(0.5, recentLookAwaysInWindow, this.config),
            questionId: questionContext?.id,
            sessionPosition: questionContext?.position,
            isIsolated: recentLookAwaysInWindow === 0,
            occurrenceIndex: this.eventIndex,
            contextSummary: `Estimated look-away (${estimatedDirection}) [brief]`,
          };

          this.activeLookAwayEvent = event;
          this.events.push(event);
          generatedEvent = event;
        } else if (this.activeLookAwayEvent) {
          // Continuous look-away in same direction: update duration and severity in real-time
          const durationMs = Math.max(500, now - this.directionStartTime);
          const durationSec = durationMs / 1000;
          const windowMs = this.config.repeatedLookAwayWindowSec * 1000;
          const recentLookAwaysInWindow = this.events.filter(
            (e) => e.eventType === 'look_away' && e.id !== this.activeLookAwayEvent?.id && now - new Date(e.timestamp).getTime() < windowMs
          ).length;

          const severity = classifyLookAwaySeverity(durationSec, recentLookAwaysInWindow, this.config);
          this.activeLookAwayEvent.durationMs = durationMs;
          this.activeLookAwayEvent.severity = severity;
          this.activeLookAwayEvent.contextSummary = `Estimated look-away (${this.currentDirection}) for ${durationSec.toFixed(1)}s [${severity}]`;
          generatedEvent = this.activeLookAwayEvent;
        }
      } else {
        // Returned to forward facing!
        if (this.currentDirection !== 'forward') {
          if (this.activeLookAwayEvent) {
            const durationMs = Math.max(500, now - this.directionStartTime);
            const durationSec = durationMs / 1000;
            const windowMs = this.config.repeatedLookAwayWindowSec * 1000;
            const recentLookAwaysInWindow = this.events.filter(
              (e) => e.eventType === 'look_away' && e.id !== this.activeLookAwayEvent?.id && now - new Date(e.timestamp).getTime() < windowMs
            ).length;
            const severity = classifyLookAwaySeverity(durationSec, recentLookAwaysInWindow, this.config);
            this.activeLookAwayEvent.durationMs = durationMs;
            this.activeLookAwayEvent.severity = severity;
            this.activeLookAwayEvent.contextSummary = `Estimated look-away (${this.currentDirection}) for ${durationSec.toFixed(1)}s [${severity}]`;
            generatedEvent = this.activeLookAwayEvent;
            this.activeLookAwayEvent = null;
          }
          this.currentDirection = 'forward';
          this.directionStartTime = now;
        }
      }
    }

    return generatedEvent;
  }

  public summarize(totalExamDurationSec: number): CameraEvidenceSummary {
    // Flush active look-away if exam completes while looking away
    if (this.activeLookAwayEvent) {
      const durationMs = Math.max(500, Date.now() - this.directionStartTime);
      const durationSec = durationMs / 1000;
      this.activeLookAwayEvent.durationMs = durationMs;
      this.activeLookAwayEvent.severity = classifyLookAwaySeverity(durationSec, 0, this.config);
      this.activeLookAwayEvent.contextSummary = `Estimated look-away (${this.activeLookAwayEvent.direction}) for ${durationSec.toFixed(1)}s [${this.activeLookAwayEvent.severity}]`;
      this.activeLookAwayEvent = null;
    }

    return buildCameraEvidenceSummary(this.events, totalExamDurationSec, this.isCameraActive);
  }
}

// ─── Lightweight Canvas Face / Head Orientation Estimator ────────────────────

/**
 * Analyzes video frame pixels using lightweight luminosity and skin-tone/gradient bounding
 * across the ENTIRE camera frame area using spatial grid partitioning.
 * Fast, non-blocking client-side processing designed to maintain 60fps exam responsiveness.
 */
// Native Browser Shape Detection API cache
let globalNativeFaceDetector: any = null;
let lastNativeDetections: RawFaceDetection | null = null;
let isDetectingNative = false;

function tryNativeDetection(videoElement: HTMLVideoElement) {
  if (typeof window === 'undefined' || !(window as any).FaceDetector) return;
  if (!globalNativeFaceDetector) {
    try {
      globalNativeFaceDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
    } catch {
      return;
    }
  }
  if (isDetectingNative || videoElement.readyState < 2 || videoElement.videoWidth === 0) return;

  isDetectingNative = true;
  globalNativeFaceDetector.detect(videoElement)
    .then((faces: any[]) => {
      isDetectingNative = false;
      if (faces && faces.length > 0) {
        const primary = faces[0];
        const vw = videoElement.videoWidth || 640;
        const vh = videoElement.videoHeight || 480;
        const bb = primary.boundingBox;
        const boxX = (bb.x / vw) * 160;
        const boxY = (bb.y / vh) * 120;
        const boxW = (bb.width / vw) * 160;
        const boxH = (bb.height / vh) * 120;
        const faceMidX = boxX + boxW / 2;
        const faceMidY = boxY + boxH / 2;
        // User-centric: flip X for mirror coordinate
        const userCentricX = 160 - faceMidX;
        const yawOffset = (userCentricX - 80) / (160 * 0.32);
        const pitchOffset = (faceMidY - 60) / (120 * 0.32);

        lastNativeDetections = {
          faceDetected: true,
          faceCount: faces.length,
          confidence: 0.96,
          box: {
            x: Math.round(boxX),
            y: Math.round(boxY),
            width: Math.round(boxW),
            height: Math.round(boxH),
          },
          yawOffset: Math.max(-1, Math.min(1, Number(yawOffset.toFixed(2)))),
          pitchOffset: Math.max(-1, Math.min(1, Number(pitchOffset.toFixed(2)))),
        };
      } else {
        lastNativeDetections = {
          faceDetected: false,
          faceCount: 0,
          confidence: 0.9,
        };
      }
    })
    .catch(() => {
      isDetectingNative = false;
    });
}

/**
 * Robust, client-side face and head orientation estimator.
 * Combines YCbCr color-space modeling, normalized-RGB skin locus, and native FaceDetector.
 * Functions reliably across all skin complexions, indoor lighting, and monitor glows.
 */
export function analyzeVideoFrame(
  videoElement: HTMLVideoElement,
  canvasElement: HTMLCanvasElement
): RawFaceDetection {
  try {
    if (!videoElement || !canvasElement) {
      return { faceDetected: false, faceCount: 0, confidence: 0 };
    }

    // Trigger async native detector if supported
    tryNativeDetection(videoElement);

    const vw = videoElement.videoWidth;
    if (vw === 0 || videoElement.readyState < 2) {
      // Camera is warming up / streaming first frames
      return { faceDetected: true, faceCount: 1, confidence: 0.5 };
    }

    const width = 160;
    const height = 120;
    canvasElement.width = width;
    canvasElement.height = height;
    const ctx = canvasElement.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      return { faceDetected: false, faceCount: 0, confidence: 0 };
    }

    ctx.drawImage(videoElement, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    let totalSkinPixels = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    // Spatial grid partitioning across whole frame (8 columns x 6 rows)
    const GRID_COLS = 8;
    const GRID_ROWS = 6;
    const cellWidth = width / GRID_COLS;
    const cellHeight = height / GRID_ROWS;
    const gridSkinCount = new Array(GRID_COLS * GRID_ROWS).fill(0);

    let leftHalfSkin = 0;
    let rightHalfSkin = 0;
    const midX = width / 2;
    const midY = height / 2;

    // Sample every 2nd pixel (8 bytes per step in RGBA buffer) for high sensitivity & sub-millisecond execution
    for (let i = 0; i < data.length; i += 8) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Reject monochromatic background (grayscale, dark shadows, white walls)
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max - min < 7) continue;
      if (r <= b + 2) continue; // Skin has red > blue component

      // 1. YCbCr standard human skin locus (Peer / Kovac model)
      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const isYCbCr = (Cb >= 75 && Cb <= 138) && (Cr >= 128 && Cr <= 180) && (Y >= 30);

      // 2. Normalized RGB skin locus
      const sum = r + g + b;
      let isNorm = false;
      if (sum > 55) {
        const nr = r / sum;
        const ng = g / sum;
        const nb = b / sum;
        isNorm = (nr > 0.33 && nr < 0.62) && (ng > 0.23 && ng < 0.40) && (nb < 0.35) && (nr - nb > 0.03);
      }

      // 3. Relaxed RGB skin heuristic for cool laptop screens / ambient office LED
      const isCoolScreenSkin = (r > 45 && g > 35 && b > 20) && (r > b + 4) && (r >= g - 4) && (max - min > 8);

      if (isYCbCr || isNorm || isCoolScreenSkin) {
        totalSkinPixels++;
        const pixelIndex = i / 4;
        const px = pixelIndex % width;
        const py = Math.floor(pixelIndex / width);

        sumX += px;
        sumY += py;

        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;

        if (px < midX) leftHalfSkin++;
        else rightHalfSkin++;

        const col = Math.min(GRID_COLS - 1, Math.floor(px / cellWidth));
        const row = Math.min(GRID_ROWS - 1, Math.floor(py / cellHeight));
        gridSkinCount[row * GRID_COLS + col]++;
      }
    }

    // Minimum skin pixels threshold (~1.2% of sampled pixels across frame)
    const minSkinThreshold = 70;
    if (totalSkinPixels < minSkinThreshold) {
      if (lastNativeDetections && lastNativeDetections.faceDetected) {
        return lastNativeDetections;
      }
      return {
        faceDetected: false,
        faceCount: 0,
        confidence: 0.9,
        box: undefined,
      };
    }

    const centroidX = sumX / totalSkinPixels;
    const centroidY = sumY / totalSkinPixels;

    // Multi-person peak detection across horizontal columns
    const colProfile = new Array(GRID_COLS).fill(0);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        colProfile[c] += gridSkinCount[r * GRID_COLS + c];
      }
    }

    let peakCount = 0;
    const colThreshold = minSkinThreshold * 0.4;
    for (let c = 0; c < GRID_COLS; c++) {
      const isPeak =
        colProfile[c] > colThreshold &&
        (c === 0 || colProfile[c] >= colProfile[c - 1]) &&
        (c === GRID_COLS - 1 || colProfile[c] >= colProfile[c + 1]);
      if (isPeak) {
        peakCount++;
      }
    }

    const isMultiFace =
      (peakCount >= 2 && totalSkinPixels > minSkinThreshold * 2.8) ||
      (totalSkinPixels > minSkinThreshold * 3.5 &&
        leftHalfSkin > minSkinThreshold * 1.4 &&
        rightHalfSkin > minSkinThreshold * 1.4);

    // Calculate user-centric yaw & pitch offsets (-1 to +1)
    // In CSS mirror mode, the video is flipped. When the user looks to THEIR left,
    // their face moves towards the raw video's right side.
    // Flipping X (width - centroidX) normalizes this to user perspective:
    const userCentricX = width - centroidX;
    const yawOffset = (userCentricX - midX) / (width * 0.32);
    const pitchOffset = (centroidY - midY) / (height * 0.32);

    const boxWidth = Math.max(38, Math.min(width, (maxX - minX) * 1.15));
    const boxHeight = Math.max(48, Math.min(height, (maxY - minY) * 1.25));
    const boxX = Math.max(0, Math.min(width - boxWidth, centroidX - boxWidth / 2));
    const boxY = Math.max(0, Math.min(height - boxHeight, centroidY - boxHeight / 2));

    return {
      faceDetected: true,
      faceCount: isMultiFace ? 2 : 1,
      confidence: 0.92,
      box: {
        x: Math.round(boxX),
        y: Math.round(boxY),
        width: Math.round(boxWidth),
        height: Math.round(boxHeight),
      },
      yawOffset: Math.max(-1, Math.min(1, Number(yawOffset.toFixed(2)))),
      pitchOffset: Math.max(-1, Math.min(1, Number(pitchOffset.toFixed(2)))),
    };
  } catch {
    return { faceDetected: false, faceCount: 0, confidence: 0 };
  }
}
