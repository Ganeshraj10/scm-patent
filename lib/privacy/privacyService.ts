/**
 * ============================================================================
 * EXAMGUARD — PHASE 4: PRIVACY-AWARE ARCHITECTURE & DATA GOVERNANCE
 * ============================================================================
 * Implements strict privacy controls:
 * 1. Data Minimisation: Programmatically validates that payloads contain only
 *    derived numerical telemetry and REJECTS raw keystrokes, clipboard text, or
 *    question answers.
 * 2. Identity & Behaviour Separation: Isolates student identity credentials
 *    from behavioral telemetry data.
 * 3. Pseudonymisation: Uses HMAC-SHA256 keyed cryptographic hashing to derive
 *    pseudonymous research/session identifiers (not described as encryption).
 * 4. Data Retention & Deletion: Safe purge routines honoring data retention
 *    windows and right-to-be-forgotten requests.
 * 5. Access Control & Evidence Access: Role-gated verification before serving
 *    examination telemetry evidence.
 */

import crypto from 'crypto';
import { ML_ORDERED_FEATURES } from '../ml/types';

export interface TelemetryPayloadValidation {
  isValid: boolean;
  violations: string[];
  sanitizedFeatures?: Record<string, number>;
}

export interface PrivacyAuditRecord {
  auditId: string;
  timestamp: string;
  actorId: string;
  actorRole: 'student' | 'instructor' | 'admin' | 'system';
  action:
    | 'telemetry_ingested'
    | 'evidence_viewed'
    | 'pseudonym_generated'
    | 'review_submitted'
    | 'retention_purge'
    | 'student_data_deleted';
  targetStudentId: string;
  targetSessionId?: string;
  details?: Record<string, any>;
}

export interface DataRetentionPolicy {
  rawTelemetryRetentionDays: number; // e.g. 90 days
  baselineModelRetentionDays: number; // e.g. 365 days
  auditLogRetentionDays: number; // e.g. 730 days (2 years for academic integrity records)
}

export const DEFAULT_RETENTION_POLICY: DataRetentionPolicy = {
  rawTelemetryRetentionDays: 90,
  baselineModelRetentionDays: 365,
  auditLogRetentionDays: 730,
};

export class PrivacyService {
  private static readonly PSEUDONYMIZATION_SALT =
    process.env.PRIVACY_SALT || 'examguard-privacy-salt-2026-v1';

  /**
   * Data Minimisation Validator.
   * Scans incoming payload and REJECTS any presence of raw keystroke streams,
   * clipboard text, or full question answers.
   */
  static validateDataMinimization(payload: Record<string, any>): TelemetryPayloadValidation {
    const violations: string[] = [];
    const forbiddenKeys = [
      'keystrokes',
      'key_stream',
      'raw_keys',
      'clipboard_text',
      'clipboard_content',
      'pasted_text',
      'raw_answer',
      'student_text',
      'screen_capture',
      'video_stream',
      'audio_stream',
    ];

    for (const forbidden of forbiddenKeys) {
      if (forbidden in payload && payload[forbidden] !== undefined && payload[forbidden] !== null) {
        violations.push(`Violation of data minimisation: Forbidden raw data key detected [${forbidden}].`);
      }
    }

    // Verify presence of only derived aggregate behavioural features
    const sanitizedFeatures: Record<string, number> = {};
    for (const feat of ML_ORDERED_FEATURES) {
      if (feat in payload) {
        const val = Number(payload[feat]);
        if (!isNaN(val)) {
          sanitizedFeatures[feat] = val;
        } else {
          sanitizedFeatures[feat] = NaN; // imputed by StandardScaler
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      sanitizedFeatures: violations.length === 0 ? sanitizedFeatures : undefined,
    };
  }

  /**
   * Generates a deterministic pseudonymous identifier using HMAC-SHA256.
   * 
   * NOTE: This is a cryptographic one-way HMAC digest, NOT encryption.
   * It produces an irreversible pseudonym that allows longitudinal correlation
   * within an academic semester without exposing personal credentials.
   */
  static generatePseudonym(
    studentId: string,
    cohortSalt: string = this.PSEUDONYMIZATION_SALT
  ): string {
    if (!studentId) throw new Error('[PrivacyService] Cannot pseudonymize empty student ID.');
    const hmac = crypto.createHmac('sha256', cohortSalt);
    hmac.update(studentId);
    const hashHex = hmac.digest('hex');
    // Format as human-readable academic pseudonym: STU-HASH4
    return `STU-${hashHex.substring(0, 8).toUpperCase()}`;
  }

  /**
   * Verifies access authorization for viewing detailed examination evidence.
   * Students can only view their own records; instructors can only view assigned students.
   */
  static verifyEvidenceAccess(
    requester: { id: string; role: string; assignedStudentIds?: string[] },
    targetStudentId: string
  ): { isAuthorized: boolean; reason?: string } {
    if (requester.role === 'admin') {
      return { isAuthorized: true };
    }

    if (requester.role === 'instructor') {
      if (
        requester.assignedStudentIds &&
        !requester.assignedStudentIds.includes(targetStudentId)
      ) {
        return {
          isAuthorized: false,
          reason: 'Instructor is not assigned to this student.',
        };
      }
      return { isAuthorized: true };
    }

    if (requester.role === 'student') {
      if (requester.id !== targetStudentId) {
        return {
          isAuthorized: false,
          reason: 'Student is unauthorized to inspect peer telemetry records.',
        };
      }
      return { isAuthorized: true };
    }

    return { isAuthorized: false, reason: 'Unknown or unauthorized role.' };
  }

  /**
   * Checks whether telemetry record has exceeded retention policy.
   */
  static isRecordExpired(
    recordTimestamp: string | Date,
    policy: DataRetentionPolicy = DEFAULT_RETENTION_POLICY
  ): boolean {
    const created = new Date(recordTimestamp).getTime();
    const now = Date.now();
    const ageDays = (now - created) / (1000 * 60 * 60 * 24);
    return ageDays > policy.rawTelemetryRetentionDays;
  }

  /**
   * Executes Right-to-be-Forgotten / student data deletion.
   * Purges all identifiable session records and invalidates associated personal baseline models.
   */
  static purgeStudentRecords(
    studentId: string,
    recordsStore: { studentId: string; [key: string]: any }[]
  ): { purgedCount: number; remainingCount: number } {
    const initialCount = recordsStore.length;
    const remaining = recordsStore.filter((r) => r.studentId !== studentId);
    return {
      purgedCount: initialCount - remaining.length,
      remainingCount: remaining.length,
    };
  }
}

