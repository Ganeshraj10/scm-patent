/**
 * ExamGuard — Mock Alerts / Review Queue
 * Human review items for sessions flagged for behavioral deviation.
 */

import type { Review } from '@/types';

export const mockAlerts: Review[] = [
  {
    id: 'rev-001',
    sessionId: 'ses-004',
    studentId: 'stu-002',
    studentName: 'Priya Nair',
    examName: 'Machine Learning Final',
    deviationScore: 67.3,
    personalizedThreshold: 35.0,
    severity: 'high',
    status: 'review_required',
    createdAt: '2026-08-18T09:20:00Z',
  },
  {
    id: 'rev-002',
    sessionId: 'ses-012',
    studentId: 'stu-005',
    studentName: 'Marcus Johnson',
    examName: 'Linear Algebra Final',
    deviationScore: 58.1,
    personalizedThreshold: 32.0,
    severity: 'high',
    status: 'disputed',
    createdAt: '2026-08-15T16:25:00Z',
    reviewedAt: '2026-08-16T10:00:00Z',
    reviewedBy: 'Dr. Adams',
    notes: 'Student claims tablet touchscreen issues caused anomalous pointer data. Under review.',
  },
  {
    id: 'rev-003',
    sessionId: 'ses-014',
    studentId: 'stu-005',
    studentName: 'Marcus Johnson',
    examName: 'Statistics Midterm',
    deviationScore: 41.7,
    personalizedThreshold: 32.0,
    severity: 'medium',
    status: 'review_required',
    createdAt: '2026-07-22T09:30:00Z',
  },
  {
    id: 'rev-004',
    sessionId: 'ses-009',
    studentId: 'stu-004',
    studentName: 'Sofia Petrov',
    examName: 'Database Systems Final',
    deviationScore: 31.2,
    personalizedThreshold: 38.0,
    severity: 'low',
    status: 'verified',
    createdAt: '2026-08-18T13:05:00Z',
    reviewedAt: '2026-08-18T15:30:00Z',
    reviewedBy: 'Prof. Williams',
    notes: 'Reviewed behavioral evidence. Score within acceptable range. Verified free of misconduct.',
  },
];

export function getAlertById(id: string): Review | undefined {
  return mockAlerts.find((a) => a.id === id);
}

export function getAlertsByStudent(studentId: string): Review[] {
  return mockAlerts.filter((a) => a.studentId === studentId);
}

export function getAlertsByStatus(status: string): Review[] {
  return mockAlerts.filter((a) => a.status === status);
}
