import { buildBehavioralModel } from '../lib/modelingEngine';
import { evaluateSessionDeviation } from '../lib/deviationEngine';
import { BehavioralSession } from '../types';

function createMockSession(id: string, studentId: string, features: any, date: string): any {
  return {
    id,
    studentId,
    type: 'low_stakes',
    date,
    features: Array.isArray(features) ? features : [features],
  };
}

describe('Phase 6: Personalized Threshold Calibration', () => {
  it('1. <10 sessions -> cold_start', () => {
    const sessions = Array(5).fill(0).map((_, i) => createMockSession(`s${i}`, 'stu1', { responseTime: 10 }, `2026-08-01T00:00:0${i}Z`));
    const model = buildBehavioralModel('stu1', sessions);
    expect(model.status).toBe('cold_start');
  });

  it('2. exactly 10 sessions -> active', () => {
    const sessions = Array(10).fill(0).map((_, i) => createMockSession(`s${i}`, 'stu1', { responseTime: 10 }, `2026-08-01T00:00:0${i}Z`));
    const model = buildBehavioralModel('stu1', sessions);
    expect(model.status).toBe('active');
  });

  it('3. 80/20 split (10 sessions -> 8 train, 2 calibrate)', () => {
    const sessions = Array(10).fill(0).map((_, i) => createMockSession(`s${i}`, 'stu1', { responseTime: 10 }, `2026-08-01T00:00:0${i}Z`));
    const model = buildBehavioralModel('stu1', sessions);
    expect(model.uncertainties[0].sampleSize).toBe(8);
  });

  it('4. deterministic chronological split', () => {
    const sessions = Array(10).fill(0).map((_, i) => {
      const responseTime = i >= 8 ? 100 : 10;
      const day = i < 9 ? `0${i + 1}` : `${i + 1}`;
      return createMockSession(`s${i}`, 'stu1', { responseTime }, `2026-08-${day}T00:00:00Z`);
    });
    
    const scrambled = [...sessions].reverse();
    const model = buildBehavioralModel('stu1', scrambled);
    
    const rtExpectation = model.expectations.find(e => e.feature === 'responseTime');
    expect(rtExpectation?.mean).toBe(10);
  });

  it('5. & 6. calibration scores use training-only model and calculate threshold', () => {
    const sessions = Array(10).fill(0).map((_, i) => {
      const responseTime = i >= 8 ? 20 : 10;
      const day = i < 9 ? `0${i + 1}` : `${i + 1}`;
      return createMockSession(`s${i}`, 'stu1', { responseTime }, `2026-08-${day}T00:00:00Z`);
    });
    const model = buildBehavioralModel('stu1', sessions);
    expect(model.calibratedThreshold).toBeGreaterThan(1.5);
    expect(model.calibratedThreshold).toBeDefined();
  });

  it('7. normal exam below threshold & 8. anomalous exam above threshold', () => {
    const sessions = Array(10).fill(0).map((_, i) => {
      const day = i < 9 ? `0${i + 1}` : `${i + 1}`;
      return createMockSession(`s${i}`, 'stu1', { 
        responseTime: 10, pointerMovement: 100, scrollDistance: 200, revisionCount: 1, pasteDetected: 0 
      }, `2026-08-${day}T00:00:00Z`);
    });
    const model = buildBehavioralModel('stu1', sessions);

    const normalExam = {
      id: 'e1', studentId: 'stu1',
      features: [{ responseTime: 10, pointerMovement: 100, scrollDistance: 200, revisionCount: 1, pasteDetected: false }]
    } as BehavioralSession;
    
    const normalResult = evaluateSessionDeviation(normalExam, model);
    expect(normalResult.reviewRequired).toBe(false);

    const anomalousExam = {
      id: 'e2', studentId: 'stu1',
      features: [{ responseTime: 50, pointerMovement: 1000, scrollDistance: 0, revisionCount: 5, pasteDetected: true }]
    } as BehavioralSession;

    const anomalousResult = evaluateSessionDeviation(anomalousExam, model);
    expect(anomalousResult.reviewRequired).toBe(true);
  });

  it('9. threshold changes when historical behavior changes', () => {
    const stableSessions = Array(10).fill(0).map((_, i) => createMockSession(`s${i}`, 'stu1', { responseTime: 10 }, `2026-08-01T00:00:0${i}Z`));
    const modelStable = buildBehavioralModel('stu1', stableSessions);

    const erraticSessions = Array(10).fill(0).map((_, i) => {
      const rt = i >= 8 ? 1000 : 10; // High non-conformity in calibration
      return createMockSession(`s${i}`, 'stu1', { responseTime: rt }, `2026-08-01T00:00:0${i}Z`);
    });
    const modelErratic = buildBehavioralModel('stu1', erraticSessions);

    expect(modelStable.calibratedThreshold).not.toEqual(modelErratic.calibratedThreshold);
  });

  it('10. different students receive different thresholds', () => {
    const sessionsA = Array(10).fill(0).map((_, i) => {
      const rt = i >= 8 ? 1000 : 10;
      return createMockSession(`s${i}`, 'stuA', { responseTime: rt }, `2026-08-01T00:00:0${i}Z`);
    });
    const modelA = buildBehavioralModel('stuA', sessionsA);

    const sessionsB = Array(10).fill(0).map((_, i) => {
      const rt = i >= 8 ? 50 : 10;
      return createMockSession(`s${i}`, 'stuB', { responseTime: rt }, `2026-08-01T00:00:0${i}Z`);
    });
    const modelB = buildBehavioralModel('stuB', sessionsB);

    expect(modelA.calibratedThreshold).not.toEqual(modelB.calibratedThreshold);
  });
});
