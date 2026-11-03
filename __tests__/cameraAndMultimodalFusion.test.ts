import {
  classifyLookAwaySeverity,
  estimateLookAwayDirection,
  evaluateFacePresence,
  evaluateMultiplePersonState,
  buildCameraEvidenceSummary,
  CameraProctoringTracker,
  CAMERA_PROCTORING_CONFIG,
} from '@/lib/services/cameraProctoringService';
import { fuseMultimodalEvidence } from '@/lib/services/multimodalFusionEngine';
import {
  CameraIntegrityEvent,
  IntegrityOpportunityEvent,
  ContinuousConsistencyScore,
  BehavioralStateInference,
} from '@/types';

describe('Layer 2 & Layer 3: Camera Proctoring & Multimodal Evidence Fusion', () => {
  describe('Layer 2 — Camera Evidence Feature Extraction', () => {
    it('estimates observable look-away direction from geometric yaw/pitch offsets', () => {
      // Forward facing
      expect(estimateLookAwayDirection(0.05, 0.05)).toBe('forward');
      // Look left
      expect(estimateLookAwayDirection(-0.45, 0.05)).toBe('left');
      // Look right
      expect(estimateLookAwayDirection(0.5, 0.1)).toBe('right');
      // Look up
      expect(estimateLookAwayDirection(0.05, -0.4)).toBe('up');
      // Look down
      expect(estimateLookAwayDirection(0.05, 0.45)).toBe('down');
    });

    it('evaluates face presence and multiple-person presence states', () => {
      expect(evaluateFacePresence(1, 0.9)).toBe('face_present');
      expect(evaluateFacePresence(0, 0.9)).toBe('face_missing');
      expect(evaluateFacePresence(1, 0.2)).toBe('detection_uncertain');

      expect(evaluateMultiplePersonState(1, 0.9)).toBe('single_face');
      expect(evaluateMultiplePersonState(2, 0.9)).toBe('multiple_faces');
    });

    it('classifies look-away severity: brief vs prolonged vs repeated', () => {
      // Brief look-away (< 2.5s)
      expect(classifyLookAwaySeverity(1.5, 0)).toBe('brief');
      // Prolonged look-away (>= 3.0s)
      expect(classifyLookAwaySeverity(3.5, 0)).toBe('prolonged');
      // Repeated look-away (>= 3 events in window)
      expect(classifyLookAwaySeverity(1.8, 3)).toBe('repeated');
      // Sustained look-away (long + repeated)
      expect(classifyLookAwaySeverity(4.0, 3)).toBe('sustained');
    });

    it('CameraProctoringTracker logs discrete debounced events and builds summary', () => {
      const tracker = new CameraProctoringTracker();

      // Normal forward frame
      tracker.processFrame({ faceDetected: true, faceCount: 1, confidence: 0.9, yawOffset: 0, pitchOffset: 0 });

      // Look right for 1.5 seconds
      tracker.processFrame({ faceDetected: true, faceCount: 1, confidence: 0.9, yawOffset: 0.5, pitchOffset: 0 });

      // Return forward (triggers look_away event logging)
      tracker.processFrame({ faceDetected: true, faceCount: 1, confidence: 0.9, yawOffset: 0, pitchOffset: 0 });

      // Multiple person frame
      tracker.processFrame({ faceDetected: true, faceCount: 2, confidence: 0.9, yawOffset: 0, pitchOffset: 0 });

      const events = tracker.getEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.eventType === 'multiple_persons')).toBe(true);

      const summary = tracker.summarize(60);
      expect(summary.isCameraActive).toBe(true);
      expect(summary.facePresencePercentage).toBeGreaterThanOrEqual(90);
    });

    it('differentiates camera technical interruption from student face absence', () => {
      const tracker = new CameraProctoringTracker();
      tracker.recordInterruption('Video track dropped');

      const events = tracker.getEvents();
      const intEvent = events.find((e) => e.eventType === 'camera_interrupted');
      expect(intEvent).toBeDefined();
      expect(intEvent?.contextSummary).toContain('interrupted');

      const summary = tracker.summarize(60);
      expect(summary.cameraInterruptionCount).toBe(1);
      expect(summary.overallCameraStatus).toBe('interrupted');
    });
  });

  describe('Layer 3 — Multimodal Temporal Evidence Fusion Engine', () => {
    // TEST A — Normal Exam
    it('TEST A: Normal exam with face present and nominal behavior yields low concern', () => {
      const result = fuseMultimodalEvidence({
        sessionId: 'S001_EX01',
        studentId: 'S001',
        deviationScore: 12.5,
        personalizedThreshold: 35,
        consistencyScore: {
          overallScore: 92,
          statusLabel: 'Normal Consistency',
          rollingWindows: [],
          factorsConsidered: [],
        },
        stateInference: {
          currentState: 'Stable Interaction',
          stateLabel: 'Stable Interaction',
          confidence: 90,
          reasoning: 'Nominal interaction flow',
          observableFactors: ['Pacing normal'],
          stateTimeline: [],
        },
        cameraSummary: {
          overallCameraStatus: 'active',
          facePresencePercentage: 99,
          totalAbsenceDurationSec: 0,
          totalLookAwayEvents: 1,
          briefLookAwayCount: 1,
          prolongedLookAwayCount: 0,
          repeatedLookAwayCount: 0,
          multiplePersonEventCount: 0,
          cameraInterruptionCount: 0,
          lookAwayDirectionCounts: { forward: 0, left: 0, right: 1, up: 0, down: 0, uncertain: 0 },
          isCameraActive: true,
        },
      });

      expect(result.overallAssessmentLevel).toBe('low_concern');
      expect(result.assessmentTitle).toContain('Low Concern');
      expect(result.recommendationForReviewer).toContain('No action required');
    });

    // TEST B — Brief Look-Away
    it('TEST B: Brief look-away with normal behavior does not trigger elevated concern', () => {
      const result = fuseMultimodalEvidence({
        sessionId: 'S001_EX02',
        studentId: 'S001',
        deviationScore: 18.0,
        personalizedThreshold: 35,
        cameraSummary: {
          overallCameraStatus: 'active',
          facePresencePercentage: 96,
          totalAbsenceDurationSec: 2,
          totalLookAwayEvents: 2,
          briefLookAwayCount: 2,
          prolongedLookAwayCount: 0,
          repeatedLookAwayCount: 0,
          multiplePersonEventCount: 0,
          cameraInterruptionCount: 0,
          lookAwayDirectionCounts: { forward: 0, left: 1, right: 1, up: 0, down: 0, uncertain: 0 },
          isCameraActive: true,
        },
      });

      expect(result.overallAssessmentLevel).toBe('low_concern');
      expect(result.correlationPatterns.some((p) => p.patternType === 'isolated_distraction')).toBe(true);
    });

    // TEST C — Prolonged Repeated Look-Away + Paste / Burst Anomaly
    it('TEST C: Prolonged/repeated look-away temporally correlated with paste/burst triggers elevated review recommendation', () => {
      const result = fuseMultimodalEvidence({
        sessionId: 'S001_EX03',
        studentId: 'S001',
        deviationScore: 78.5,
        personalizedThreshold: 35,
        interactions: [
          {
            recordId: 'rec_1',
            studentId: 'S001',
            sessionId: 'S001_EX03',
            questionId: 'Q_CODE_01',
            sessionPosition: 1,
            questionType: 'coding',
            questionDifficulty: 0.7,
            responseTimeSec: 6.2,
            selectedAnswerIndex: null,
            answerRevisionCount: 0,
            answerRevisionTimeSec: 0,
            pointerDistancePx: 80,
            pointerAvgSpeedPxS: 25,
            scrollDistancePx: 0,
            scrollEvents: 0,
            pasteDetected: 1,
            characterBurstFlag: 1,
            deviceType: 'desktop',
            timeOfDay: 'morning',
            timestamp: new Date().toISOString(),
            isAnswerCorrect: true,
          },
        ],
        cameraSummary: {
          overallCameraStatus: 'active',
          facePresencePercentage: 82,
          totalAbsenceDurationSec: 15,
          totalLookAwayEvents: 5,
          briefLookAwayCount: 1,
          prolongedLookAwayCount: 3,
          repeatedLookAwayCount: 2,
          multiplePersonEventCount: 0,
          cameraInterruptionCount: 0,
          lookAwayDirectionCounts: { forward: 0, left: 0, right: 4, up: 0, down: 0, uncertain: 1 },
          isCameraActive: true,
        },
      });

      expect(result.overallAssessmentLevel).toBe('elevated_review_recommended');
      expect(result.correlationPatterns.some((p) => p.patternType === 'correlated_anomaly')).toBe(true);
      expect(result.recommendationForReviewer).toContain('Recommend instructor review');
    });

    // TEST D — Multiple Person Presence
    it('TEST D: Multiple-person detection creates integrity opportunity review pattern', () => {
      const result = fuseMultimodalEvidence({
        sessionId: 'S001_EX04',
        studentId: 'S001',
        deviationScore: 22.0,
        personalizedThreshold: 35,
        cameraSummary: {
          overallCameraStatus: 'active',
          facePresencePercentage: 94,
          totalAbsenceDurationSec: 0,
          totalLookAwayEvents: 1,
          briefLookAwayCount: 1,
          prolongedLookAwayCount: 0,
          repeatedLookAwayCount: 0,
          multiplePersonEventCount: 1,
          cameraInterruptionCount: 0,
          lookAwayDirectionCounts: { forward: 0, left: 0, right: 0, up: 0, down: 0, uncertain: 0 },
          isCameraActive: true,
        },
      });

      expect(result.overallAssessmentLevel).toBe('review_recommended');
      expect(result.correlationPatterns.some((p) => p.cameraSignals.some((s) => s.includes('multiple-person')))).toBe(true);
    });

    // TEST E — Camera Technical Failure (Simultaneous Connection Drop)
    it('TEST E: Camera interruption occurring with network drop produces technical explanation context', () => {
      const result = fuseMultimodalEvidence({
        sessionId: 'S001_EX05',
        studentId: 'S001',
        deviationScore: 20.0,
        personalizedThreshold: 35,
        integrityEvents: [
          {
            id: 'int_1',
            eventType: 'connection_interrupt',
            timestamp: new Date().toISOString(),
            isIsolated: true,
            occurrenceIndex: 1,
            contextSummary: 'Network drop',
          },
        ],
        cameraSummary: {
          overallCameraStatus: 'interrupted',
          facePresencePercentage: 85,
          totalAbsenceDurationSec: 10,
          totalLookAwayEvents: 0,
          briefLookAwayCount: 0,
          prolongedLookAwayCount: 0,
          repeatedLookAwayCount: 0,
          multiplePersonEventCount: 0,
          cameraInterruptionCount: 1,
          lookAwayDirectionCounts: { forward: 0, left: 0, right: 0, up: 0, down: 0, uncertain: 0 },
          isCameraActive: false,
        },
      });

      expect(result.overallAssessmentLevel).toBe('technical_inconclusive');
      expect(result.correlationPatterns.some((p) => p.patternType === 'technical_interruption')).toBe(true);
      expect(result.recommendationForReviewer).toContain('connectivity instability');
    });

    // TEST F — Historically Normal Student Changes Behavior Real-Time
    it('TEST F: Real-time multimodal anomaly flags review even with established historical baseline', () => {
      const result = fuseMultimodalEvidence({
        sessionId: 'S001_EX06',
        studentId: 'S001',
        baselineMaturity: 'established',
        deviationScore: 65.0,
        personalizedThreshold: 35,
        interactions: [
          {
            recordId: 'rec_2',
            studentId: 'S001',
            sessionId: 'S001_EX06',
            questionId: 'Q_CODE_02',
            sessionPosition: 2,
            questionType: 'coding',
            questionDifficulty: 0.8,
            responseTimeSec: 4.5,
            selectedAnswerIndex: null,
            answerRevisionCount: 0,
            answerRevisionTimeSec: 0,
            pointerDistancePx: 50,
            pointerAvgSpeedPxS: 20,
            scrollDistancePx: 0,
            scrollEvents: 0,
            pasteDetected: 1,
            characterBurstFlag: 1,
            deviceType: 'desktop',
            timeOfDay: 'morning',
            timestamp: new Date().toISOString(),
            isAnswerCorrect: true,
          },
        ],
        cameraSummary: {
          overallCameraStatus: 'active',
          facePresencePercentage: 88,
          totalAbsenceDurationSec: 8,
          totalLookAwayEvents: 4,
          briefLookAwayCount: 1,
          prolongedLookAwayCount: 2,
          repeatedLookAwayCount: 1,
          multiplePersonEventCount: 0,
          cameraInterruptionCount: 0,
          lookAwayDirectionCounts: { forward: 0, left: 0, right: 3, up: 0, down: 0, uncertain: 0 },
          isCameraActive: true,
        },
      });

      expect(result.overallAssessmentLevel).toBe('elevated_review_recommended');
    });

    // TEST G — Nervous Student (Hesitation, Not Misconduct)
    it('TEST G: Nervous student with high revisions and continuous face presence is classified as deliberation', () => {
      const result = fuseMultimodalEvidence({
        sessionId: 'S002_EX01',
        studentId: 'S002',
        deviationScore: 28.0,
        personalizedThreshold: 35,
        stateInference: {
          currentState: 'Hesitation',
          stateLabel: 'Hesitation',
          confidence: 80,
          reasoning: 'Extended response time and multiple answer reconsiderations',
          observableFactors: ['Answer revised 4 times', 'Response time +25s'],
          stateTimeline: [],
        },
        cameraSummary: {
          overallCameraStatus: 'active',
          facePresencePercentage: 99,
          totalAbsenceDurationSec: 0,
          totalLookAwayEvents: 1,
          briefLookAwayCount: 1,
          prolongedLookAwayCount: 0,
          repeatedLookAwayCount: 0,
          multiplePersonEventCount: 0,
          cameraInterruptionCount: 0,
          lookAwayDirectionCounts: { forward: 0, left: 0, right: 0, up: 0, down: 1, uncertain: 0 },
          isCameraActive: true,
        },
      });

      expect(result.overallAssessmentLevel).toBe('low_concern');
      expect(result.correlationPatterns.some((p) => p.patternType === 'natural_deliberation')).toBe(true);
      expect(result.observedBehavioralState).toBe('Hesitation');
    });

    // TEST H — Privacy-by-Design Verification
    it('TEST H: Camera evidence and multimodal assessment contain only lightweight metadata and zero raw video frames', () => {
      const tracker = new CameraProctoringTracker();
      tracker.processFrame({ faceDetected: true, faceCount: 1, confidence: 0.9, yawOffset: 0.4, pitchOffset: 0 });
      tracker.processFrame({ faceDetected: true, faceCount: 1, confidence: 0.9, yawOffset: 0, pitchOffset: 0 });

      const events = tracker.getEvents();
      events.forEach((e) => {
        // Ensure no image buffers or binary blobs
        expect((e as any).videoBlob).toBeUndefined();
        expect((e as any).imageData).toBeUndefined();
        expect((e as any).frameBase64).toBeUndefined();
        // Ensure valid metadata fields
        expect(e.id).toBeDefined();
        expect(e.timestamp).toBeDefined();
        expect(typeof e.isIsolated).toBe('boolean');
      });
    });
  });
});
