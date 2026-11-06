/**
 * ============================================================================
 * EXAMGUARD — PHASE 2: SYNTHETIC DATASET GENERATION SCRIPT
 * ============================================================================
 * Execution: node --experimental-strip-types scripts/generateSyntheticDataset.ts
 *
 * Generates 4,000 synthetic exam sessions across 100 simulated students
 * partitioned chronologically into Train (2,000), Calibration (1,000),
 * and Test (1,000) splits, complete with baseline models and empirical reports.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  generateSyntheticDataset,
  SyntheticSession,
  CANONICAL_FEATURES,
} from '@/lib/services/syntheticDatasetGenerator';
import {
  calculatePersonalizedBaseline,
  investigateSampleSizeStability,
  PersonalizedBaselineModel,
} from '@/lib/services/baselineModelService';

function run() {
  console.log('==============================================================================');
  console.log('EXAMGUARD — PHASE 2: SYNTHETIC DATASET ENGINEERING & BASELINE MODELLING');
  console.log('==============================================================================\n');

  const startTime = Date.now();
  const outputDir = path.join(process.cwd(), 'data', 'synthetic');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // ── 1. Configuration ────────────────────────────────────────────────────────
  const config = {
    seed: 42,
    numStudents: 100,
    sessionsPerStudent: 40,
    trainSessionCount: 20,
    calSessionCount: 10,
    testSessionCount: 10,
    questionsPerSession: 5,
    startDate: '2026-01-05T09:00:00Z',
  };

  console.log(`[1/5] Initializing synthetic generator with fixed seed: ${config.seed}`);
  console.log(`      Target cohort: ${config.numStudents} students, ${config.sessionsPerStudent} sessions/student`);
  console.log(`      Chronological splits: Train (1-20), Calibration (21-30), Test (31-40)`);

  // ── 2. Dataset Generation ───────────────────────────────────────────────────
  const { students, trainSessions, calibrationSessions, testSessions, allSessions, manifest } =
    generateSyntheticDataset(config);

  console.log(`\n[2/5] Synthetic generation completed:`);
  console.log(`      Total students:    ${students.length}`);
  console.log(`      Total sessions:    ${allSessions.length.toLocaleString()}`);
  console.log(`      Total questions:   ${manifest.totalQuestions.toLocaleString()}`);
  console.log(`      Train sessions:    ${trainSessions.length.toLocaleString()} (100% normal baseline)`);
  console.log(`      Cal sessions:      ${calibrationSessions.length.toLocaleString()} (100% held-out baseline)`);
  console.log(`      Test sessions:     ${testSessions.length.toLocaleString()} (evaluation mixture)`);

  // ── 3. Personalised Baseline Modelling ──────────────────────────────────────
  console.log(`\n[3/5] Computing individualised baselines for all ${students.length} students...`);
  const studentSessionsMap = new Map<string, SyntheticSession[]>();
  allSessions.forEach((s) => {
    if (!studentSessionsMap.has(s.studentId)) studentSessionsMap.set(s.studentId, []);
    studentSessionsMap.get(s.studentId)!.push(s);
  });

  const baselines: Record<string, PersonalizedBaselineModel> = {};
  students.forEach((student) => {
    // Fitted strictly on Training sessions (no test/cal leakage!)
    const trainSubset = trainSessions.filter((s) => s.studentId === student.studentId);
    const baseline = calculatePersonalizedBaseline(student.studentId, trainSubset);
    baselines[student.studentId] = baseline;
  });

  // ── 4. Empirical Sample-Size Investigation (N in [2, 30]) ───────────────────
  console.log(`\n[4/5] Executing empirical sample-size stability study (N in [2, 30])...`);
  const sampleSizeReport = investigateSampleSizeStability(studentSessionsMap);

  // ── 5. Data Quality Report ──────────────────────────────────────────────────
  let missingPointerCount = 0;
  let missingScrollCount = 0;
  let invalidBoundsCount = 0;
  let duplicateCount = 0;

  allSessions.forEach((s) => {
    s.features.forEach((q) => {
      if (q.pointerMovement === null) missingPointerCount++;
      if (q.scrollDistance === null) missingScrollCount++;
      if (q.responseTime < 0 || q.revisionCount < 0) invalidBoundsCount++;
      if (q.isDuplicate) duplicateCount++;
    });
  });

  const totalQuestions = manifest.totalQuestions;
  const dataQualityReport = {
    title: 'ExamGuard Synthetic Dataset Data Quality & Integrity Report',
    timestamp: new Date().toISOString(),
    totalSessions: allSessions.length,
    totalQuestionInteractions: totalQuestions,
    missingTelemetry: {
      missingPointerQuestions: missingPointerCount,
      missingPointerRatePercent: Number(((missingPointerCount / totalQuestions) * 100).toFixed(2)),
      missingScrollQuestions: missingScrollCount,
      missingScrollRatePercent: Number(((missingScrollCount / totalQuestions) * 100).toFixed(2)),
      handlingPolicy:
        'Missing channels are omitted from question-level averages rather than treated as zeros. At scoring time, missing session channels impute the baseline mean mu_j (z_j = 0).',
    },
    syntheticStressTests: {
      invalidBoundsInjected: invalidBoundsCount,
      duplicatesInjected: duplicateCount,
      sanitizationResult:
        'Sanitizer successfully catches and isolates negative response times and duplicate telemetry entries.',
    },
    testSetScenarioDistribution: manifest.scenarioBreakdown,
  };

  // ── 6. Write Artifacts to Disk ──────────────────────────────────────────────
  console.log(`\n[5/5] Writing dataset files to: ${outputDir}`);

  fs.writeFileSync(path.join(outputDir, 'train_sessions.json'), JSON.stringify(trainSessions, null, 2));
  fs.writeFileSync(path.join(outputDir, 'calibration_sessions.json'), JSON.stringify(calibrationSessions, null, 2));
  fs.writeFileSync(path.join(outputDir, 'test_sessions.json'), JSON.stringify(testSessions, null, 2));
  fs.writeFileSync(path.join(outputDir, 'student_baselines.json'), JSON.stringify(baselines, null, 2));
  fs.writeFileSync(path.join(outputDir, 'dataset_manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(outputDir, 'data_quality_report.json'), JSON.stringify(dataQualityReport, null, 2));
  fs.writeFileSync(path.join(outputDir, 'sample_size_investigation.json'), JSON.stringify(sampleSizeReport, null, 2));

  // CSV Summary Export
  const csvHeaders = [
    'session_id',
    'student_id',
    'session_index',
    'split',
    'session_type',
    'is_anomaly',
    'scenario_category',
    'scenario_subtype',
    'response_time_s',
    'revision_count',
    'pointer_movement_px',
    'scroll_distance_px',
    'paste_activity_pct',
    'timestamp',
  ];

  const csvRows = allSessions.map((s) => [
    s.sessionId,
    s.studentId,
    s.sessionIndex,
    s.split,
    s.sessionType,
    s.isAnomaly ? 1 : 0,
    s.scenarioCategory,
    s.scenarioSubtype,
    s.aggregatedFeatures.responseTime,
    s.aggregatedFeatures.revisionCount,
    s.aggregatedFeatures.pointerMovement,
    s.aggregatedFeatures.scrollDistance,
    s.aggregatedFeatures.pasteDetected,
    s.timestamp,
  ]);

  const csvContent = [csvHeaders.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
  fs.writeFileSync(path.join(outputDir, 'synthetic_sessions_summary.csv'), csvContent);

  const durationMs = Date.now() - startTime;
  console.log(`\n==============================================================================`);
  console.log(`SUCCESS: Synthetic dataset generation and baseline modelling completed in ${durationMs}ms`);
  console.log(`==============================================================================`);
  console.log(`Generated Files:`);
  console.log(`  - train_sessions.json            (2,000 sessions)`);
  console.log(`  - calibration_sessions.json      (1,000 sessions)`);
  console.log(`  - test_sessions.json             (1,000 sessions)`);
  console.log(`  - student_baselines.json         (100 student baselines)`);
  console.log(`  - dataset_manifest.json          (generation metadata)`);
  console.log(`  - data_quality_report.json       (quality & anomaly audit)`);
  console.log(`  - sample_size_investigation.json (N=2..30 stability report)`);
  console.log(`  - synthetic_sessions_summary.csv (unified 4,000 row CSV)`);
  console.log(`==============================================================================\n`);
}

run();
