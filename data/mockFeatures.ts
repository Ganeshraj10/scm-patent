/**
 * ExamGuard — Mock Behavioral Features & Models
 * Per-student personalized behavioral models and feature expectations.
 */

import type { BehavioralModel, DeviationDataPoint } from '@/types';

// ─── Personalized behavioral models per student ──────────────

export const mockBehavioralModels: Record<string, BehavioralModel> = {
  'stu-001': {
    studentId: 'stu-001',
    status: 'active',
    sessionCount: 24,
    minimumSessionsRequired: 10,
    confidence: 91,
    lastUpdated: '2026-08-17T14:35:00Z',
    expectations: [
      { feature: 'responseTime', label: 'Response Time', unit: 's', mean: 18400, stdDev: 3200, min: 8000, max: 32000 },
      { feature: 'revisionCount', label: 'Revision Count', unit: 'revisions', mean: 1.2, stdDev: 0.6, min: 0, max: 4 },
      { feature: 'pointerMovement', label: 'Pointer Movement', unit: 'px', mean: 1240, stdDev: 280, min: 620, max: 2100 },
      { feature: 'scrollDistance', label: 'Scroll Distance', unit: 'px', mean: 410, stdDev: 95, min: 150, max: 720 },
      { feature: 'pasteDetected', label: 'Paste Frequency', unit: '%', mean: 5, stdDev: 2, min: 0, max: 10 },
    ],
    uncertainties: [
      { feature: 'responseTime', uncertainty: 0.09, sampleSize: 24 },
      { feature: 'revisionCount', uncertainty: 0.11, sampleSize: 24 },
      { feature: 'pointerMovement', uncertainty: 0.08, sampleSize: 24 },
      { feature: 'scrollDistance', uncertainty: 0.10, sampleSize: 24 },
      { feature: 'pasteDetected', uncertainty: 0.06, sampleSize: 24 },
    ],
  },
  'stu-002': {
    studentId: 'stu-002',
    status: 'active',
    sessionCount: 31,
    minimumSessionsRequired: 10,
    confidence: 94,
    lastUpdated: '2026-08-01T10:30:00Z',
    expectations: [
      { feature: 'responseTime', label: 'Response Time', unit: 's', mean: 18400, stdDev: 2800, min: 9000, max: 30000 },
      { feature: 'revisionCount', label: 'Revision Count', unit: 'revisions', mean: 1.4, stdDev: 0.7, min: 0, max: 5 },
      { feature: 'pointerMovement', label: 'Pointer Movement', unit: 'px', mean: 1380, stdDev: 310, min: 700, max: 2400 },
      { feature: 'scrollDistance', label: 'Scroll Distance', unit: 'px', mean: 450, stdDev: 110, min: 180, max: 800 },
      { feature: 'pasteDetected', label: 'Paste Frequency', unit: '%', mean: 5, stdDev: 2, min: 0, max: 12 },
    ],
    uncertainties: [
      { feature: 'responseTime', uncertainty: 0.06, sampleSize: 31 },
      { feature: 'revisionCount', uncertainty: 0.08, sampleSize: 31 },
      { feature: 'pointerMovement', uncertainty: 0.07, sampleSize: 31 },
      { feature: 'scrollDistance', uncertainty: 0.09, sampleSize: 31 },
      { feature: 'pasteDetected', uncertainty: 0.05, sampleSize: 31 },
    ],
  },
  'stu-003': {
    studentId: 'stu-003',
    status: 'cold_start',
    sessionCount: 7,
    minimumSessionsRequired: 10,
    confidence: 45,
    lastUpdated: '2026-08-16T11:05:00Z',
    expectations: [
      { feature: 'responseTime', label: 'Response Time', unit: 's', mean: 22000, stdDev: 5100, min: 10000, max: 40000 },
      { feature: 'revisionCount', label: 'Revision Count', unit: 'revisions', mean: 0.8, stdDev: 0.5, min: 0, max: 3 },
      { feature: 'pointerMovement', label: 'Pointer Movement', unit: 'px', mean: 890, stdDev: 320, min: 300, max: 1800 },
      { feature: 'scrollDistance', label: 'Scroll Distance', unit: 'px', mean: 310, stdDev: 120, min: 80, max: 650 },
      { feature: 'pasteDetected', label: 'Paste Frequency', unit: '%', mean: 3, stdDev: 2, min: 0, max: 8 },
    ],
    uncertainties: [
      { feature: 'responseTime', uncertainty: 0.38, sampleSize: 7 },
      { feature: 'revisionCount', uncertainty: 0.42, sampleSize: 7 },
      { feature: 'pointerMovement', uncertainty: 0.45, sampleSize: 7 },
      { feature: 'scrollDistance', uncertainty: 0.40, sampleSize: 7 },
      { feature: 'pasteDetected', uncertainty: 0.35, sampleSize: 7 },
    ],
  },
  'stu-004': {
    studentId: 'stu-004',
    status: 'active',
    sessionCount: 42,
    minimumSessionsRequired: 10,
    confidence: 96,
    lastUpdated: '2026-08-18T13:05:00Z',
    expectations: [
      { feature: 'responseTime', label: 'Response Time', unit: 's', mean: 21000, stdDev: 2600, min: 11000, max: 34000 },
      { feature: 'revisionCount', label: 'Revision Count', unit: 'revisions', mean: 1.5, stdDev: 0.5, min: 0, max: 4 },
      { feature: 'pointerMovement', label: 'Pointer Movement', unit: 'px', mean: 1420, stdDev: 260, min: 750, max: 2200 },
      { feature: 'scrollDistance', label: 'Scroll Distance', unit: 'px', mean: 490, stdDev: 100, min: 200, max: 800 },
      { feature: 'pasteDetected', label: 'Paste Frequency', unit: '%', mean: 5, stdDev: 2, min: 0, max: 10 },
    ],
    uncertainties: [
      { feature: 'responseTime', uncertainty: 0.04, sampleSize: 42 },
      { feature: 'revisionCount', uncertainty: 0.05, sampleSize: 42 },
      { feature: 'pointerMovement', uncertainty: 0.04, sampleSize: 42 },
      { feature: 'scrollDistance', uncertainty: 0.06, sampleSize: 42 },
      { feature: 'pasteDetected', uncertainty: 0.03, sampleSize: 42 },
    ],
  },
  'stu-005': {
    studentId: 'stu-005',
    status: 'active',
    sessionCount: 17,
    minimumSessionsRequired: 10,
    confidence: 78,
    lastUpdated: '2026-08-05T11:30:00Z',
    expectations: [
      { feature: 'responseTime', label: 'Response Time', unit: 's', mean: 22100, stdDev: 4200, min: 10000, max: 38000 },
      { feature: 'revisionCount', label: 'Revision Count', unit: 'revisions', mean: 0.9, stdDev: 0.6, min: 0, max: 4 },
      { feature: 'pointerMovement', label: 'Pointer Movement', unit: 'px', mean: 980, stdDev: 290, min: 350, max: 1900 },
      { feature: 'scrollDistance', label: 'Scroll Distance', unit: 'px', mean: 380, stdDev: 130, min: 100, max: 720 },
      { feature: 'pasteDetected', label: 'Paste Frequency', unit: '%', mean: 8, stdDev: 3, min: 0, max: 18 },
    ],
    uncertainties: [
      { feature: 'responseTime', uncertainty: 0.20, sampleSize: 17 },
      { feature: 'revisionCount', uncertainty: 0.24, sampleSize: 17 },
      { feature: 'pointerMovement', uncertainty: 0.22, sampleSize: 17 },
      { feature: 'scrollDistance', uncertainty: 0.25, sampleSize: 17 },
      { feature: 'pasteDetected', uncertainty: 0.18, sampleSize: 17 },
    ],
  },
  'stu-006': {
    studentId: 'stu-006',
    status: 'cold_start',
    sessionCount: 4,
    minimumSessionsRequired: 10,
    confidence: 30,
    lastUpdated: '2026-08-14T10:05:00Z',
    expectations: [
      { feature: 'responseTime', label: 'Response Time', unit: 's', mean: 25000, stdDev: 7000, min: 12000, max: 50000 },
      { feature: 'revisionCount', label: 'Revision Count', unit: 'revisions', mean: 1.0, stdDev: 0.8, min: 0, max: 4 },
      { feature: 'pointerMovement', label: 'Pointer Movement', unit: 'px', mean: 1100, stdDev: 450, min: 400, max: 2500 },
      { feature: 'scrollDistance', label: 'Scroll Distance', unit: 'px', mean: 350, stdDev: 160, min: 80, max: 800 },
      { feature: 'pasteDetected', label: 'Paste Frequency', unit: '%', mean: 4, stdDev: 3, min: 0, max: 12 },
    ],
    uncertainties: [
      { feature: 'responseTime', uncertainty: 0.58, sampleSize: 4 },
      { feature: 'revisionCount', uncertainty: 0.62, sampleSize: 4 },
      { feature: 'pointerMovement', uncertainty: 0.65, sampleSize: 4 },
      { feature: 'scrollDistance', uncertainty: 0.60, sampleSize: 4 },
      { feature: 'pasteDetected', uncertainty: 0.55, sampleSize: 4 },
    ],
  },
};

// ─── Deviation over time chart data ─────────────────────────

export const mockDeviationHistory: Record<string, DeviationDataPoint[]> = {
  'stu-001': [
    { date: '2026-05-10', deviationScore: 16.2, threshold: 35, reviewRequired: false },
    { date: '2026-05-24', deviationScore: 18.4, threshold: 35, reviewRequired: false },
    { date: '2026-06-07', deviationScore: 14.8, threshold: 35, reviewRequired: false },
    { date: '2026-06-21', deviationScore: 20.1, threshold: 35, reviewRequired: false },
    { date: '2026-07-05', deviationScore: 17.9, threshold: 35, reviewRequired: false },
    { date: '2026-07-19', deviationScore: 22.3, threshold: 35, reviewRequired: false },
    { date: '2026-08-02', deviationScore: 15.6, threshold: 35, reviewRequired: false },
    { date: '2026-08-17', deviationScore: 19.4, threshold: 35, reviewRequired: false },
  ],
  'stu-002': [
    { date: '2026-04-15', deviationScore: 18.2, threshold: 35, reviewRequired: false },
    { date: '2026-05-01', deviationScore: 22.4, threshold: 35, reviewRequired: false },
    { date: '2026-05-20', deviationScore: 19.8, threshold: 35, reviewRequired: false },
    { date: '2026-06-10', deviationScore: 24.1, threshold: 35, reviewRequired: false },
    { date: '2026-06-30', deviationScore: 28.4, threshold: 35, reviewRequired: false },
    { date: '2026-07-15', deviationScore: 31.0, threshold: 35, reviewRequired: false },
    { date: '2026-08-01', deviationScore: 21.1, threshold: 35, reviewRequired: false },
    { date: '2026-08-18', deviationScore: 67.3, threshold: 35, reviewRequired: true },
  ],
  'stu-004': [
    { date: '2026-03-01', deviationScore: 14.2, threshold: 38, reviewRequired: false },
    { date: '2026-04-10', deviationScore: 16.5, threshold: 38, reviewRequired: false },
    { date: '2026-05-05', deviationScore: 18.3, threshold: 38, reviewRequired: false },
    { date: '2026-06-01', deviationScore: 15.7, threshold: 38, reviewRequired: false },
    { date: '2026-07-05', deviationScore: 15.3, threshold: 38, reviewRequired: false },
    { date: '2026-07-20', deviationScore: 17.8, threshold: 38, reviewRequired: false },
    { date: '2026-08-18', deviationScore: 31.2, threshold: 38, reviewRequired: false },
  ],
  'stu-005': [
    { date: '2026-05-15', deviationScore: 24.4, threshold: 32, reviewRequired: false },
    { date: '2026-06-01', deviationScore: 28.1, threshold: 32, reviewRequired: false },
    { date: '2026-06-20', deviationScore: 31.5, threshold: 32, reviewRequired: false },
    { date: '2026-07-08', deviationScore: 29.4, threshold: 32, reviewRequired: false },
    { date: '2026-07-22', deviationScore: 41.7, threshold: 32, reviewRequired: true },
    { date: '2026-08-05', deviationScore: 29.4, threshold: 32, reviewRequired: false },
    { date: '2026-08-15', deviationScore: 58.1, threshold: 32, reviewRequired: true },
  ],
};
