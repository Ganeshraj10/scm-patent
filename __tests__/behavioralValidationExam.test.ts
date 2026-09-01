import {
  createInitialTelemetryState,
  finalizeQuestionTelemetry,
  recordMCQSelection,
  recordMultiSelectToggle,
  recordTextChange,
  recordCodeEdit,
  recordCodeRun,
  recordPasteEvent,
  calculateInsertionRate,
  CHARACTER_BURST_CONFIG,
} from '../lib/services/examFeatureExtractor';
import { executeCodeAgainstTestCases } from '../lib/services/codeRunner';
import { validationExamQuestions } from '../data/validationExamQuestions';
import { ExamQuestionTelemetry } from '../types';

describe('Stage 7: Realistic Exam Types & Behavioral Feature Validation (Correction)', () => {
  // ─── Reusable calculateInsertionRate Unit Tests ─────────────────────────────
  test('calculateInsertionRate correctly differentiates typing rates', () => {
    // Normal typing: 10 chars over 1 second (10 chars/sec)
    const normal = calculateInsertionRate(10, 1000);
    expect(normal.insertionRateCharsPerSec).toBe(10.0);
    expect(normal.isBurst).toBe(false);

    // Small paste: 15 chars in 50ms (300 chars/sec, but <35 chars threshold)
    const smallPaste = calculateInsertionRate(15, 50);
    expect(smallPaste.isBurst).toBe(false);

    // Large rapid paste: 500 chars in 50ms (10,000 chars/sec)
    const largePaste = calculateInsertionRate(500, 50);
    expect(largePaste.insertionRateCharsPerSec).toBe(10000.0);
    expect(largePaste.isBurst).toBe(true);

    // Single instant insertion: 70 chars in 100ms
    const instantLarge = calculateInsertionRate(70, 100);
    expect(instantLarge.isBurst).toBe(true);
  });

  // ─── TEST 1: Normal Typing ─────────────────────────────────────────────────
  test('TEST 1 — Normal typing results in paste_detected = 0 and character_burst_flag = 0', () => {
    const state = createInitialTelemetryState('val-q04', 4, 0.5, 'short_answer');
    state.startTimeMs = Date.now() - 5000;

    // Simulate typing 50 characters naturally
    const text = 'BFS uses a Queue while DFS uses a Stack for search.';
    let current = '';
    for (const char of text) {
      current += char;
      recordTextChange(state, current);
    }

    const telemetry = finalizeQuestionTelemetry(state, 'S001_EX_TEST', 'S001', 'web_desktop');
    expect(telemetry.pasteDetected).toBe(0);
    expect(telemetry.characterBurstFlag).toBe(0);
    expect(telemetry.textAnswerLength).toBe(text.length);
  });

  // ─── TEST 2: Small Paste ───────────────────────────────────────────────────
  test('TEST 2 — Small paste produces paste_detected = 1 while character_burst_flag remains 0', () => {
    const state = createInitialTelemetryState('val-q05', 5, 0.7, 'coding');
    state.startTimeMs = Date.now() - 3000;

    // User pastes a small token (e.g. variable name 'target_complement')
    const smallToken = 'target_complement';
    recordPasteEvent(state);
    recordCodeEdit(state, smallToken);

    const telemetry = finalizeQuestionTelemetry(state, 'S001_EX_TEST', 'S001', 'web_desktop');
    expect(telemetry.pasteDetected).toBe(1);
    expect(telemetry.characterBurstFlag).toBe(0);
    expect((telemetry as any).clipboardContent).toBeUndefined();
  });

  // ─── TEST 3: Large Code Paste ──────────────────────────────────────────────
  test('TEST 3 — Large code paste produces paste_detected = 1 and character_burst_flag = 1', () => {
    const starterCode = 'def two_sum(nums, target):\n    pass\n';
    const state = createInitialTelemetryState('val-q05', 5, 0.7, 'coding', starterCode);
    state.startTimeMs = Date.now() - 2000;

    // Student pastes a 450-character full solution instantly as initial action
    const largePastedCode = `def two_sum(nums, target):
    lookup_table = {}
    for current_index, current_number in enumerate(nums):
        required_difference = target - current_number
        if required_difference in lookup_table:
            return [lookup_table[required_difference], current_index]
        lookup_table[current_number] = current_index
    return []
`;
    recordPasteEvent(state);
    recordCodeEdit(state, largePastedCode);

    expect(largePastedCode.length).toBeGreaterThan(CHARACTER_BURST_CONFIG.SINGLE_EVENT_CHAR_THRESHOLD);
    expect(state.characterBurstFlag).toBe(1);
    expect(state.pasteDetected).toBe(1);

    const telemetry = finalizeQuestionTelemetry(state, 'S001_EX_TEST', 'S001', 'web_desktop');
    expect(telemetry.pasteDetected).toBe(1);
    expect(telemetry.characterBurstFlag).toBe(1);
    expect(telemetry.maxInsertionRate).toBeGreaterThanOrEqual(100);
    expect(telemetry.burstThresholdUsed).toBe(100);
  });

  // ─── TEST 4: Large Slow Insertion (No Burst) ───────────────────────────────
  test('TEST 4 — Large text typed slowly over time produces character_burst_flag = 0', () => {
    const state = createInitialTelemetryState('val-q08', 8, 0.65, 'short_answer');
    state.startTimeMs = Date.now() - 120000; // 2 minutes elapsed

    // Simulate steady typing of 100 characters in chunks of 5 chars with realistic pauses
    let content = '';
    for (let i = 0; i < 20; i++) {
      content += 'word ';
      state.lastInputTimeMs = Date.now() - (20 - i) * 2000; // 2 seconds apart
      recordTextChange(state, content);
    }

    const telemetry = finalizeQuestionTelemetry(state, 'S001_EX_TEST', 'S001', 'web_desktop');
    expect(telemetry.characterBurstFlag).toBe(0);
  });

  // ─── TEST 5: Code Editing & Revision Tracking ──────────────────────────────
  test('TEST 5 — Code editing increments code_revision_count without false burst flags', () => {
    const starter = 'def factorial(n):\n    pass\n';
    const state = createInitialTelemetryState('val-q07', 7, 0.8, 'debugging', starter);
    state.startTimeMs = Date.now() - 10000;

    recordCodeEdit(state, 'def factorial(n):\n    if n == 0:\n');
    recordCodeEdit(state, 'def factorial(n):\n    if n == 0:\n        return 1\n');
    recordCodeEdit(state, 'def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n - 1)\n');

    expect(state.codeRevisionCount).toBe(3);
    expect(state.characterBurstFlag).toBe(0);
    expect(state.timeToFirstEditMs).toBeGreaterThanOrEqual(0);

    const telemetry = finalizeQuestionTelemetry(state, 'S001_EX_TEST', 'S001', 'web_desktop');
    expect(telemetry.codeRevisionCount).toBe(3);
    expect(telemetry.characterBurstFlag).toBe(0);
  });

  // ─── Additional Validations ────────────────────────────────────────────────
  test('MCQ and Multiple Select track selection toggles independently', () => {
    const stateMCQ = createInitialTelemetryState('val-q01', 1, 0.25, 'mcq');
    recordMCQSelection(stateMCQ, 0);
    recordMCQSelection(stateMCQ, 1);
    expect(stateMCQ.revisionCount).toBe(1);

    const stateMSQ = createInitialTelemetryState('val-q03', 3, 0.45, 'multiple_select');
    recordMultiSelectToggle(stateMSQ, 0);
    recordMultiSelectToggle(stateMSQ, 1);
    recordMultiSelectToggle(stateMSQ, 1); // deselect
    expect(stateMSQ.selectedAnswerIndices).toEqual([0]);
    expect(stateMSQ.revisionCount).toBe(2);
  });

  test('Privacy check: telemetry does not store clipboard text or raw keystrokes', () => {
    const state = createInitialTelemetryState('val-q05', 5, 0.7, 'coding');
    recordPasteEvent(state);
    const telemetry = finalizeQuestionTelemetry(state, 'S001_EX_TEST', 'S001', 'web_desktop');

    expect((telemetry as any).rawMousePath).toBeUndefined();
    expect((telemetry as any).rawKeystrokes).toBeUndefined();
    expect((telemetry as any).clipboardContent).toBeUndefined();
  });
});
