/**
 * ExamGuard — Demo Student Profiles Service
 * 
 * Configures 4 dedicated demo student profiles for prototype demonstration
 * of personalized longitudinal history and model maturity progression.
 * 
 * Model Maturity Levels:
 * - Cold Start: 0–2 low-stakes coursework sessions (Insufficient History)
 * - Developing: 3–5 low-stakes coursework sessions (Emerging Personal Baseline)
 * - Established: 6+ low-stakes coursework sessions (Mature Personal Baseline)
 * 
 * Principle:
 * Each student is evaluated exclusively against their own historical data.
 * Student A and Student B both exhibit "normal" behavior despite significantly
 * different individual response speeds and revision frequencies.
 */

import { MaturityStatus } from '@/types';

export interface DemoStudentProfile {
  id: string; // 'S001', 'S002', 'S003', 'S004'
  name: string;
  profileKey: 'STUDENT_A' | 'STUDENT_B' | 'STUDENT_C' | 'STUDENT_D';
  displayTitle: string;
  modelMaturity: MaturityStatus;
  maturityLabel: string;
  eligibleLowStakesSessions: string[];
  lowStakesSessionCount: number;
  characteristics: {
    avgResponseTimeSec: number;
    avgRevisions: number;
    avgPointerSpeedPxS: number;
    avgScrollDistancePx: number;
    primaryDevice: string;
    behavioralNotes: string;
  };
  demoExplanation: string;
  patentConceptDemonstrated: string;
}

export const DEMO_STUDENT_PROFILES: Record<string, DemoStudentProfile> = {
  S001: {
    id: 'S001',
    name: 'Alex Chen',
    profileKey: 'STUDENT_A',
    displayTitle: 'Student A — Developing History',
    modelMaturity: 'developing',
    maturityLabel: 'Developing Baseline (4 Sessions)',
    eligibleLowStakesSessions: ['S001_LS01', 'S001_LS02', 'S001_LS03', 'S001_LS04'],
    lowStakesSessionCount: 4,
    characteristics: {
      avgResponseTimeSec: 30.6,
      avgRevisions: 0.5,
      avgPointerSpeedPxS: 256.4,
      avgScrollDistancePx: 567.4,
      primaryDevice: 'web_desktop & web_laptop',
      behavioralNotes: 'Fast, direct responder. Minimal revisions (0–1). Steady cursor movement.',
    },
    demoExplanation:
      'Demonstrates a developing personal baseline with 4 low-stakes coursework sessions. Some personal history exists, but the model is still developing towards full maturity.',
    patentConceptDemonstrated:
      'Personal baseline emergence: Early coursework establishes initial individual bounds without global population merging.',
  },

  S002: {
    id: 'S002',
    name: 'Priya Nair',
    profileKey: 'STUDENT_B',
    displayTitle: 'Student B — Developing (Deliberate Responder)',
    modelMaturity: 'developing',
    maturityLabel: 'Developing Baseline (4 Sessions)',
    eligibleLowStakesSessions: ['S002_LS01', 'S002_LS02', 'S002_LS06', 'S002_LS07'],
    lowStakesSessionCount: 4,
    characteristics: {
      avgResponseTimeSec: 44.2,
      avgRevisions: 1.25,
      avgPointerSpeedPxS: 274.9,
      avgScrollDistancePx: 145.9,
      primaryDevice: 'web_desktop & mobile',
      behavioralNotes: 'Deliberate, methodical responder (~44s avg). Frequent revisions (1–2). Low scroll delta.',
    },
    demoExplanation:
      'Demonstrates that students have visibly different normal individual baselines. Slower response time and higher revision count are completely normal for Student B and must not be marked suspicious by comparing against Student A.',
    patentConceptDemonstrated:
      'Individual baseline variation: Two students can both be 100% normal while exhibiting vastly different typing speeds, response times, and revision patterns.',
  },

  S003: {
    id: 'S003',
    name: 'Marcus Vance',
    profileKey: 'STUDENT_C',
    displayTitle: 'Student C — Established Baseline',
    modelMaturity: 'established',
    maturityLabel: 'Established Baseline (8 Sessions)',
    eligibleLowStakesSessions: [
      'S003_LS01',
      'S003_LS02',
      'S003_LS03',
      'S003_LS04',
      'S003_LS05',
      'S003_LS06',
      'S003_LS07',
      'S003_LS08',
    ],
    lowStakesSessionCount: 8,
    characteristics: {
      avgResponseTimeSec: 25.2,
      avgRevisions: 0.6,
      avgPointerSpeedPxS: 226.5,
      avgScrollDistancePx: 495.0,
      primaryDevice: 'Multi-device (Desktop, Laptop, Mobile)',
      behavioralNotes: 'Extensive longitudinal history. Multi-device data points. Strong difficulty regression fit.',
    },
    demoExplanation:
      'The primary demonstration profile for the mature personalization workflow. Has 8 low-stakes sessions with multi-device calibration and difficulty-adjusted regression models.',
    patentConceptDemonstrated:
      'Mature personalized model: High confidence behavioral baseline enabling nuanced individual examination integrity verification.',
  },

  S004: {
    id: 'S004',
    name: 'Sofia Petrov',
    profileKey: 'STUDENT_D',
    displayTitle: 'Student D — Cold Start',
    modelMaturity: 'cold_start',
    maturityLabel: 'Cold Start (1 Session · Insufficient History)',
    eligibleLowStakesSessions: ['S004_LS01'],
    lowStakesSessionCount: 1,
    characteristics: {
      avgResponseTimeSec: 28.3,
      avgRevisions: 0.0,
      avgPointerSpeedPxS: 303.4,
      avgScrollDistancePx: 190.4,
      primaryDevice: 'web_laptop',
      behavioralNotes: 'Only 1 prior low-stakes practice session. Baseline cannot be reliably constructed.',
    },
    demoExplanation:
      'Demonstrates cold-start handling. With only 1 prior session, the system explicitly reports "Insufficient History" and refrains from generating ungrounded risk conclusions.',
    patentConceptDemonstrated:
      'Cold-start safety: The system refuses to fabricate baselines or borrow other students’ data when personal history is insufficient.',
  },
};

export function getDemoStudentProfiles(): DemoStudentProfile[] {
  return Object.values(DEMO_STUDENT_PROFILES);
}

export function getDemoStudentProfile(studentId: string): DemoStudentProfile | undefined {
  return DEMO_STUDENT_PROFILES[studentId];
}

export function isDemoStudent(studentId: string): boolean {
  return studentId in DEMO_STUDENT_PROFILES;
}

export function getDemoEligibleLowStakesSessions(studentId: string): string[] | undefined {
  return DEMO_STUDENT_PROFILES[studentId]?.eligibleLowStakesSessions;
}
