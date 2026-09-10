import { formatExamDate, formatAttendedDate, formatDate, formatRelativeTime } from '@/lib/formatters';
import { inferBehavioralState } from '@/lib/services/behavioralStateEngine';
import { signOutUserClient } from '@/lib/services/auth';

describe('UI and Exam Flow Audit Tests', () => {
  describe('Date and Timestamp Formatting Standards', () => {
    it('formats exam dates into clear standard strings', () => {
      const dateStr = '2026-09-10T10:32:00.000Z';
      const formatted = formatExamDate(dateStr);
      expect(formatted).toBeDefined();
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Sep');
      // Graceful fallback on null or invalid
      expect(formatExamDate(null)).toBe('—');
      expect(formatExamDate(undefined)).toBe('—');
      expect(formatExamDate('invalid-date')).toBe('—');
    });

    it('formats attended date ranges clearly', () => {
      const start = '2026-09-10T10:32:00.000Z';
      const end = '2026-09-10T11:18:00.000Z';
      const attended = formatAttendedDate(start, end);
      expect(attended).toContain('Started:');
      expect(attended).toContain('Submitted:');

      // If only start is present
      const startOnly = formatAttendedDate(start, null);
      expect(startOnly).toContain('Attended:');

      // If both are empty
      expect(formatAttendedDate(null, null)).toBe('—');
    });

    it('standard formatDate gracefully handles bad inputs', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate(undefined)).toBe('—');
      expect(formatDate('not-a-date')).toBe('—');
    });
  });

  describe('Behavioral State Inference (No Emotional Labels)', () => {
    it('infers observable interaction states with contributing signals', () => {
      // Test hesitation inference with elevated response time
      const state = inferBehavioralState({
        responseTimeSec: 45,
        expectedResponseTimeSec: 25,
        revisionCount: 1,
        expectedRevisionCount: 0,
        questionDifficulty: 0.5,
        pasteDetected: false,
        characterBurst: false,
      });

      expect(state).toBeDefined();
      expect(state.state).toBe('Hesitation');
      expect(state.confidence).toBeGreaterThan(50);
      expect(state.observableFactors.length).toBeGreaterThan(0);
      // Ensure no subjective emotion claim
      expect(state.state.toLowerCase()).not.toContain('angry');
      expect(state.state.toLowerCase()).not.toContain('stressed');
      expect(state.state.toLowerCase()).not.toContain('anxious');
    });

    it('infers stable interaction state for nominal features', () => {
      const state = inferBehavioralState({
        responseTimeSec: 25,
        expectedResponseTimeSec: 25,
        revisionCount: 0,
        expectedRevisionCount: 0,
        questionDifficulty: 0.4,
        pasteDetected: false,
        characterBurst: false,
      });

      expect(state.state).toBe('Stable Interaction');
      expect(state.observableFactors.length).toBeGreaterThan(0);
      expect(state.confidence).toBeGreaterThanOrEqual(80);
    });

    it('infers abrupt behavioral change when bursts and pastes occur', () => {
      const state = inferBehavioralState({
        responseTimeSec: 5,
        expectedResponseTimeSec: 30,
        revisionCount: 0,
        expectedRevisionCount: 0,
        questionDifficulty: 0.6,
        pasteDetected: true,
        characterBurst: true,
      });

      expect(state.state).toBe('Abrupt Behavioral Change');
      expect(state.observableFactors.some((f) => f.includes('paste') || f.includes('External'))).toBe(true);
      expect(state.observableFactors.some((f) => f.includes('insertion') || f.includes('burst'))).toBe(true);
    });
  });

  describe('Sign Out & Client State Clearance', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('signOutUserClient executes without crashing and clears local tokens in browser env', async () => {
      const cookieMock: string[] = [];
      const origDocument = (global as any).document;
      const origWindow = (global as any).window;

      (global as any).document = {
        get cookie() {
          return cookieMock.join('; ');
        },
        set cookie(val: string) {
          cookieMock.push(val);
        },
      };
      (global as any).window = {
        location: { href: '' },
      };

      try {
        await signOutUserClient('/login');
        expect(cookieMock.some((c) => c.includes('examguard_user='))).toBe(true);
        expect(cookieMock.some((c) => c.includes('examguard_role='))).toBe(true);
      } finally {
        (global as any).document = origDocument;
        (global as any).window = origWindow;
      }
    });
  });
});
