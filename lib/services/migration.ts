/**
 * ExamGuard — Migration Utility
 *
 * lib/services/migration.ts
 *
 * Manual-use-only utility to migrate existing localStorage session data to Supabase.
 * This is NOT executed automatically. Call migrateLocalSessionsToSupabase() explicitly
 * from a DevTools panel or a one-time admin script.
 *
 * IMPORTANT:
 * - This utility reads from localStorage and writes through the same service pathway
 *   (/api/sessions/*) that production submissions use.
 * - Existing records with matching IDs are skipped to prevent duplicates.
 * - The function reports successes, failures, and skips.
 *
 * DO NOT call this in application startup code or page useEffect hooks.
 */

import type { ExamSessionCreateInput, BehavioralSessionCreateInput, FeatureContributionInput } from './sessions';
import { getTrackedSessions, getExamSessions } from '@/lib/sessionStore';
import { createBehavioralSession, saveExamSession } from './sessions';

export interface MigrationResult {
  totalInspected: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

// ─── Behavioral Session Migration ─────────────────────────────────────────────

/**
 * Migrate all localStorage behavioral sessions to Supabase.
 * Only call this manually from a DemoTools or admin panel.
 */
export async function migrateLocalBehavioralSessions(
  studentId: string
): Promise<MigrationResult> {
  const result: MigrationResult = { totalInspected: 0, migrated: 0, skipped: 0, failed: 0, errors: [] };

  const localSessions = getTrackedSessions();
  result.totalInspected = localSessions.length;

  for (const session of localSessions) {
    // Skip sessions that appear to already have Supabase UUIDs (36-char UUID format)
    if (isUUID(session.id)) {
      result.skipped++;
      continue;
    }

    // Validate required fields
    if (!session.studentId || !session.type) {
      result.skipped++;
      result.errors.push({ id: session.id ?? '?', error: 'Missing studentId or type — skipped.' });
      continue;
    }

    // Build a valid feature array from the session
    const features = buildFeaturesFromLocalSession(session);
    if (!isValidFeatureList(features)) {
      result.skipped++;
      result.errors.push({ id: session.id, error: 'Invalid or empty feature data — skipped.' });
      continue;
    }

    const input: BehavioralSessionCreateInput = {
      studentId:    studentId,
      sessionType:  'low_stakes',
      deviceType:   (session.deviceType as 'desktop' | 'mobile' | 'tablet') ?? 'desktop',
      startedAt:    session.date ?? session.startedAt ?? new Date().toISOString(),
      completedAt:  session.completedAt ?? session.date ?? new Date().toISOString(),
      features,
    };

    try {
      await createBehavioralSession(input);
      result.migrated++;
    } catch (err: any) {
      result.failed++;
      result.errors.push({ id: session.id, error: err.message ?? 'Unknown error' });
    }
  }

  return result;
}

// ─── Exam Session Migration ───────────────────────────────────────────────────

/**
 * Migrate all localStorage exam sessions to Supabase.
 * Only call this manually.
 */
export async function migrateLocalExamSessions(
  studentId: string
): Promise<MigrationResult> {
  const result: MigrationResult = { totalInspected: 0, migrated: 0, skipped: 0, failed: 0, errors: [] };

  const localSessions = getExamSessions();
  result.totalInspected = localSessions.length;

  for (const session of localSessions) {
    if (isUUID(session.id)) {
      result.skipped++;
      continue;
    }

    if (!session.studentId) {
      result.skipped++;
      result.errors.push({ id: session.id ?? '?', error: 'Missing studentId — skipped.' });
      continue;
    }

    const features = buildFeaturesFromLocalSession(session);
    const contributions = buildContributionsFromLocalSession(session);

    const deviationScore = parseFinite(session.deviationScore, 0);
    const threshold      = parseFinite(session.personalizedThreshold, 0);
    const confidence     = parseFinite(session.modelConfidence ?? session.confidence, 0);

    const input: ExamSessionCreateInput = {
      studentId:            studentId,
      deviceType:           (session.deviceType as 'desktop' | 'mobile' | 'tablet') ?? 'desktop',
      startedAt:            session.date ?? new Date().toISOString(),
      submittedAt:          session.date ?? new Date().toISOString(),
      deviationScore,
      personalizedThreshold: threshold,
      confidence:           Math.min(100, Math.max(0, confidence)),
      reviewStatus:         session.reviewStatus ?? 'normal',
      features,
      featureContributions: contributions,
    };

    try {
      await saveExamSession(input);
      result.migrated++;
    } catch (err: any) {
      result.failed++;
      result.errors.push({ id: session.id, error: err.message ?? 'Unknown error' });
    }
  }

  return result;
}

/**
 * Run both behavioral and exam session migrations in sequence.
 * Returns a combined report.
 */
export async function migrateLocalSessionsToSupabase(studentId: string): Promise<{
  behavioral: MigrationResult;
  exam: MigrationResult;
}> {
  console.log('[Migration] Starting localStorage → Supabase migration for studentId:', studentId);

  const behavioral = await migrateLocalBehavioralSessions(studentId);
  console.log('[Migration] Behavioral sessions:', behavioral);

  const exam = await migrateLocalExamSessions(studentId);
  console.log('[Migration] Exam sessions:', exam);

  return { behavioral, exam };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function parseFinite(value: unknown, fallback: number): number {
  const n = Number(value);
  return isFinite(n) && !isNaN(n) ? n : fallback;
}

function isValidFeatureList(features: BehavioralSessionCreateInput['features']): boolean {
  return features.length > 0 && features.every(
    (f) => isFinite(f.responseTime) && f.responseTime >= 0
  );
}

function buildFeaturesFromLocalSession(session: any): BehavioralSessionCreateInput['features'] {
  // If the session has per-question rawTrackedData, use it
  if (session.rawTrackedData && typeof session.rawTrackedData === 'object') {
    return Object.entries(session.rawTrackedData).map(([questionId, d]: [string, any], idx) => ({
      questionId,
      responseTime:    parseFinite(d.responseTimeMs, 0),
      pointerMovement: parseFinite(d.pointerMovementPx, 0),
      scrollDistance:  parseFinite(d.scrollDistancePx, 0),
      revisionCount:   Math.max(0, parseFinite(d.revisionCount, 0)),
      pasteDetected:   (d.pasteCount ?? 0) > 0,
      deviceType:      (session.deviceType as 'desktop' | 'mobile' | 'tablet') ?? 'desktop',
      eventTimestamp:  new Date().toISOString(),
    }));
  }

  // If the session has a pre-averaged features object, build one synthetic row
  if (session.features && typeof session.features === 'object' && !Array.isArray(session.features)) {
    const f = session.features;
    return [{
      responseTime:    parseFinite(f.responseTime, 0),
      pointerMovement: parseFinite(f.pointerMovement, 0),
      scrollDistance:  parseFinite(f.scrollDistance, 0),
      revisionCount:   Math.max(0, parseFinite(f.revisionCount, 0)),
      pasteDetected:   parseFinite(f.pasteDetected, 0) > 0,
      deviceType:      (session.deviceType as 'desktop' | 'mobile' | 'tablet') ?? 'desktop',
      eventTimestamp:  new Date().toISOString(),
    }];
  }

  return [];
}

function buildContributionsFromLocalSession(session: any): FeatureContributionInput[] {
  const contributions = session.analysis?.featureContributions;
  if (!Array.isArray(contributions)) return [];

  const validDirections = new Set(['higher_than_expected', 'lower_than_expected', 'within_expected_range']);

  return contributions.map((c: any) => ({
    feature:      String(c.feature ?? ''),
    observed:     parseFinite(c.observed, 0),
    expected:     parseFinite(c.expected, 0),
    deviation:    parseFinite(c.deviation, 0),
    contribution: parseFinite(c.contribution, 0),
    direction:    validDirections.has(c.direction) ? c.direction : 'within_expected_range',
  }));
}
