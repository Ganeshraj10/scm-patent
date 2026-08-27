/**
 * ExamGuard — Session Store
 * localStorage helpers for client-side state persistence.
 * Phase 1: Basic get/set/clear operations only.
 */

const PREFIX = 'examguard_';

/**
 * Store a value in localStorage with the ExamGuard prefix.
 */
export function storeItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
  } catch (e) {
    console.warn('[SessionStore] Failed to write to localStorage:', e);
  }
}

/**
 * Retrieve a value from localStorage.
 * Returns null if not found or on parse error.
 */
export function getItem<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${key}`);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn('[SessionStore] Failed to read from localStorage:', e);
    return null;
  }
}

/**
 * Remove a value from localStorage.
 */
export function removeItem(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`${PREFIX}${key}`);
}

/**
 * Clear all ExamGuard keys from localStorage.
 */
export function clearAll(): void {
  if (typeof window === 'undefined') return;
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
  keys.forEach((k) => localStorage.removeItem(k));
}

/**
 * Store the active instructor user (mock auth placeholder).
 */
export function setCurrentUser(userId: string): void {
  storeItem('current_user', userId);
}

/**
 * Retrieve the active instructor user.
 */
export function getCurrentUser(): string | null {
  return getItem<string>('current_user');
}

/**
 * Store instructor dashboard preferences.
 */
export interface DashboardPreferences {
  sidebarCollapsed: boolean;
  selectedFilter: string;
}

export function saveDashboardPreferences(prefs: DashboardPreferences): void {
  storeItem('dashboard_prefs', prefs);
}

export function getDashboardPreferences(): DashboardPreferences {
  return (
    getItem<DashboardPreferences>('dashboard_prefs') ?? {
      sidebarCollapsed: false,
      selectedFilter: 'all',
    }
  );
}

/**
 * Persist an actual tracked session.
 */
export function appendTrackedSession(session: any): void {
  const existing = getItem<any[]>('tracked_sessions') ?? [];
  storeItem('tracked_sessions', [...existing, session]);
}

export function getTrackedSessions(): any[] {
  return getItem<any[]>('tracked_sessions') ?? [];
}

/**
 * Persist a graded exam session.
 */
export function saveExamSession(session: any): void {
  const existing = getItem<any[]>('exam_sessions') ?? [];
  storeItem('exam_sessions', [...existing, session]);
}

export function getExamSessions(): any[] {
  return getItem<any[]>('exam_sessions') ?? [];
}

export function getExamSession(id: string): any | null {
  const sessions = getExamSessions();
  return sessions.find(s => s.id === id) || null;
}

export function getReviewRequiredSessions(): any[] {
  const sessions = getExamSessions();
  return sessions.filter(s => s.reviewStatus === 'review_required');
}

export function updateExamSession(id: string, updates: any): void {
  const sessions = getExamSessions();
  const index = sessions.findIndex(s => s.id === id);
  if (index !== -1) {
    sessions[index] = { ...sessions[index], ...updates };
    storeItem('exam_sessions', sessions);
  }
}
