/**
 * ============================================================================
 * EXAMGUARD — INSTRUCTOR WEBSITE INTEGRATION & XAI REGRESSION TEST SUITE
 * ============================================================================
 * Tests website navigation paths, XAI hub multi-model switching, human-in-the-loop
 * review persistence across reloads, and non-causal pedagogical explanations.
 */

import { HumanReviewService } from '../lib/services/humanReviewService';
import { mockAlerts } from '../data/mockAlerts';
import { mockSessions } from '../data/mockSessions';

// In-memory mock for localStorage
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null,
  };
};

describe('Instructor Website Integration & Explainable AI Hub', () => {
  const originalLocalStorage = global.localStorage;

  beforeEach(() => {
    // Clear in-memory case cache before each test
    HumanReviewService.clearCaseCache();

    // Provide clean localStorage mock before each test
    const mockStorage = createLocalStorageMock();
    Object.defineProperty(global, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });
    }
  });

  afterAll(() => {
    Object.defineProperty(global, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  describe('1. Review Queue and Session Inventory', () => {
    test('getAllReviewSessions returns available sessions with proper anomaly classification', () => {
      const sessions = HumanReviewService.getAllReviewSessions();
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);

      sessions.forEach((s) => {
        expect(s.sessionId).toBeDefined();
        expect(typeof s.deviationScore).toBe('number');
        expect(typeof s.threshold).toBe('number');
        expect(typeof s.isAnomaly).toBe('boolean');
        expect(s.isAnomaly).toBe(s.deviationScore > s.threshold);
        expect(s.isSynthetic).toBe(true); // Explicitly labelled as research/synthetic data
      });
    });

    test('mockAlerts and mockSessions contain valid test fixtures for instructor navigation', () => {
      expect(mockAlerts.length).toBeGreaterThan(0);
      expect(mockSessions.length).toBeGreaterThan(0);

      const firstAlert = mockAlerts[0];
      expect(firstAlert.sessionId).toBeDefined();
      expect(firstAlert.studentId).toBeDefined();
      expect(firstAlert.deviationScore).toBeGreaterThan(0);
    });
  });

  describe('2. Multi-Model Explainability Hub Integration', () => {
    const testSessionIds = ['ses-004', 'ses-012', 'STU-0001_SES35'];

    test.each(testSessionIds)('getOrCreateCaseForSession generates 4 competing models for %s', (sessionId) => {
      const reviewCase = HumanReviewService.getOrCreateCaseForSession(sessionId);

      expect(reviewCase).toBeDefined();
      expect(reviewCase.sessionId).toBe(sessionId);
      expect(reviewCase.pseudonymousStudentId).toMatch(/^STU-[A-F0-9]{8}$/);

      // Verify all 4 competing models are evaluated
      const models = reviewCase.modelExplanations;
      const modelKeys = Object.keys(models);
      expect(modelKeys).toContain('Regularised Mahalanobis Distance');
      expect(modelKeys).toContain('Isolation Forest');
      expect(modelKeys).toContain('Local Outlier Factor');
      expect(modelKeys).toContain('One-Class SVM');

      // Verify each model provides structured attributions
      modelKeys.forEach((mKey) => {
        const exp = models[mKey];
        expect(exp.modelName).toBe(mKey);
        expect(typeof exp.rawAnomalyScore).toBe('number');
        expect(typeof exp.calibratedThreshold).toBe('number');
        expect(['higher_is_more_anomalous', 'lower_is_more_anomalous']).toContain(exp.scoreOrientation);
        expect(['Normal behaviour', 'Behavioural deviation detected', 'Review required']).toContain(
          exp.reviewCategory
        );

        // Verify 5 behavioural features
        expect(exp.features.length).toBe(5);
        const featureKeys = exp.features.map((fa) => fa.featureKey);
        expect(featureKeys).toContain('responseTime');
        expect(featureKeys).toContain('revisionCount');
        expect(featureKeys).toContain('pointerMovement');
        expect(featureKeys).toContain('scrollDistance');
        expect(featureKeys).toContain('pasteDetected');

        // Check attribution scores sum within valid range [0, 1.05]
        const sumAttribution = exp.features.reduce((s, fa) => s + fa.attributionScore, 0);
        expect(sumAttribution).toBeGreaterThanOrEqual(0);
        expect(sumAttribution).toBeLessThanOrEqual(1.05);

        // Verify non-causal disclaimer exists
        expect(typeof exp.nonCausalDisclaimer).toBe('string');
      });
    });

    test('verifies model-specific diagnostic structures for Mahalanobis, IF, LOF, and OCSVM', () => {
      const reviewCase = HumanReviewService.getOrCreateCaseForSession('ses-004');

      // Mahalanobis diagnostics
      const mahalanobisExp = reviewCase.modelExplanations['Regularised Mahalanobis Distance'];
      expect(mahalanobisExp.mahalanobisCoupling).toBeDefined();
      expect(mahalanobisExp.mahalanobisCoupling?.covarianceCouplings).toBeDefined();
      expect(mahalanobisExp.mahalanobisCoupling?.conditionalExpectedResiduals).toBeDefined();

      // Isolation Forest diagnostics
      const ifExp = reviewCase.modelExplanations['Isolation Forest'];
      expect(ifExp.isolationForestShap).toBeDefined();
      expect(ifExp.isolationForestShap?.shapleyValues).toBeDefined();
      expect(typeof ifExp.isolationForestShap?.baselineExpectedScore).toBe('number');

      // LOF diagnostics
      const lofExp = reviewCase.modelExplanations['Local Outlier Factor'];
      expect(lofExp.lofNeighbourhood).toBeDefined();
      expect(lofExp.lofNeighbourhood?.kNeighbors).toBe(5);
      expect(lofExp.lofNeighbourhood?.densityRatio).toBeGreaterThan(0);

      // OCSVM diagnostics
      const ocsvmExp = reviewCase.modelExplanations['One-Class SVM'];
      expect(ocsvmExp.svmSensitivity).toBeDefined();
      expect(ocsvmExp.svmSensitivity?.gradients).toBeDefined();
      expect(typeof ocsvmExp.svmSensitivity?.marginOffsetRho).toBe('number');
    });
  });

  describe('3. Human-in-the-Loop Review Persistence Across Reloads', () => {
    test('submitting review decision updates in-memory and persists to localStorage', async () => {
      const sessionId = 'ses-004'; // Flagged session from review queue
      const initialCase = HumanReviewService.getOrCreateCaseForSession(sessionId);
      expect(initialCase.reviewStatus).toBe('pending');

      const notes = 'Clear demonstration of legitimate thinking time on complex question.';
      await HumanReviewService.submitReviewDecision(
        sessionId,
        'PROF-SARAH-CHEN',
        'cleared_normal',
        notes
      );

      // Verify localStorage was written
      const storedJson = localStorage.getItem('examguard_human_reviews_v1');
      expect(storedJson).not.toBeNull();
      const parsedStore = JSON.parse(storedJson!);
      expect(parsedStore[sessionId]).toBeDefined();
      expect(parsedStore[sessionId].status).toBe('cleared_normal');
      expect(parsedStore[sessionId].notes).toBe(notes);
      expect(parsedStore[sessionId].reviewedBy).toBe('PROF-SARAH-CHEN');
      expect(parsedStore[sessionId].reviewedAt).toBeDefined();

      // Verify reloaded case retrieves the persisted decision
      const reloadedCase = HumanReviewService.getOrCreateCaseForSession(sessionId);
      expect(reloadedCase.reviewStatus).toBe('cleared_normal');
      expect(reloadedCase.instructorNotes).toBe(notes);
      expect(reloadedCase.reviewedBy).toBe('PROF-SARAH-CHEN');
      expect(reloadedCase.reviewedAt).toBeDefined();
    });

    test('supports all standard decision categories: cleared_normal, verified_deviation, inconclusive', async () => {
      const decisions: ('cleared_normal' | 'verified_deviation' | 'inconclusive')[] = [
        'cleared_normal',
        'verified_deviation',
        'inconclusive',
      ];

      for (const dec of decisions) {
        const testId = `SES-DECISION-${dec}`;
        await HumanReviewService.submitReviewDecision(
          testId,
          'INST-AUDITOR',
          dec,
          `Testing decision type: ${dec}`
        );

        const loadedCase = HumanReviewService.getOrCreateCaseForSession(testId);
        expect(loadedCase.reviewStatus).toBe(dec);
        expect(loadedCase.instructorNotes).toBe(`Testing decision type: ${dec}`);
      }
    });
  });

  describe('4. Settings & Calibration State Management', () => {
    test('saves and hydrates instructor settings without loss', () => {
      const mockSettings = {
        fprTarget: 4,
        minSessions: 12,
        confidenceThreshold: 80,
        featureWeights: {
          responseTime: 25,
          revisions: 25,
          pointer: 20,
          scrolling: 15,
          paste: 15,
        },
        features: {
          responseTime: true,
          revisions: true,
          pointer: true,
          scrolling: true,
          paste: true,
        },
        savedAt: new Date().toISOString(),
      };

      localStorage.setItem('examguard_instructor_settings_v1', JSON.stringify(mockSettings));

      const retrieved = localStorage.getItem('examguard_instructor_settings_v1');
      expect(retrieved).not.toBeNull();
      const parsed = JSON.parse(retrieved!);

      expect(parsed.fprTarget).toBe(4);
      expect(parsed.minSessions).toBe(12);
      expect(parsed.confidenceThreshold).toBe(80);
      expect(parsed.featureWeights.paste).toBe(15);
      expect(parsed.features.responseTime).toBe(true);
    });
  });

  describe('5. Academic Non-Causal Framing Compliance', () => {
    test('verifies that review summaries and attributions never use punitive or accusatory language', () => {
      const forbiddenTerms = [
        /\bcheating\b/i,
        /\bfraud\b/i,
        /\bguilty\b/i,
        /\bdishonest\b/i,
        /\bpenalize\b/i,
        /\bpunish\b/i,
      ];

      const reviewCase = HumanReviewService.getOrCreateCaseForSession('ses-004');

      Object.values(reviewCase.modelExplanations).forEach((exp) => {
        forbiddenTerms.forEach((pattern) => {
          expect(exp.nonCausalDisclaimer).not.toMatch(pattern);
          exp.features.forEach((fa) => {
            expect(fa.humanDescription).not.toMatch(pattern);
          });
        });

        // Ensure non-causal wording exists
        expect(exp.nonCausalDisclaimer).toMatch(
          /statistical|deviation|baseline|review|variation|behavioural/i
        );
      });
    });
  });
});
