/**
 * ExamGuard — Formatters
 * Reusable display formatting utilities.
 */

/**
 * Format an ISO date string to a human-readable date.
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format an ISO date string to date + time.
 */
export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format milliseconds to a human-readable duration string.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Format a millisecond response time to seconds.
 */
export function formatResponseTime(ms: number): string {
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Format a deviation score (0–100) for display.
 */
export function formatDeviation(score: number): string {
  return score.toFixed(1);
}

/**
 * Format a confidence percentage.
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence)}%`;
}

/**
 * Format pixel values compactly.
 */
export function formatPixels(px: number): string {
  if (px >= 1000) return `${(px / 1000).toFixed(1)}k px`;
  return `${Math.round(px)} px`;
}

/**
 * Format a relative time from now.
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(isoString);
}

/**
 * Format a percentage contribution.
 */
export function formatContribution(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Get a human-readable label for ReviewStatus.
 */
export function formatReviewStatus(status: string): string {
  const map: Record<string, string> = {
    normal: 'Normal',
    review_required: 'Review Required',
    verified: 'Verified',
    disputed: 'Disputed',
  };
  return map[status] ?? status;
}

/**
 * Get a human-readable label for ModelStatus.
 */
export function formatModelStatus(status: string): string {
  const map: Record<string, string> = {
    cold_start: 'Cold Start',
    active: 'Active',
    insufficient_data: 'Insufficient Data',
  };
  return map[status] ?? status;
}

/**
 * Get a human-readable label for SessionType.
 */
export function formatSessionType(type: string): string {
  const map: Record<string, string> = {
    low_stakes: 'Low Stakes',
    graded_examination: 'Graded Examination',
  };
  return map[type] ?? type;
}

/**
 * Capitalize first letter of a string.
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
