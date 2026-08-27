interface ProgressBarProps {
  value: number;       // 0–100
  max?: number;        // default 100
  label?: string;
  showValue?: boolean;
  size?: 'xs' | 'sm' | 'md';
  colorThresholds?: {
    low: number;       // below this → emerald
    high: number;      // above this → rose, between → amber
  };
  color?: 'indigo' | 'emerald' | 'amber' | 'rose';
  className?: string;
}

const sizeClasses = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2.5',
};

function getColorClass(
  value: number,
  thresholds?: ProgressBarProps['colorThresholds'],
  fixedColor?: ProgressBarProps['color']
): string {
  if (fixedColor) {
    const map = {
      indigo: 'bg-indigo-500',
      emerald: 'bg-emerald-500',
      amber: 'bg-amber-500',
      rose: 'bg-rose-500',
    };
    return map[fixedColor];
  }
  if (!thresholds) return 'bg-indigo-500';
  if (value < thresholds.low) return 'bg-emerald-500';
  if (value > thresholds.high) return 'bg-rose-500';
  return 'bg-amber-500';
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  size = 'sm',
  colorThresholds,
  color,
  className = '',
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colorClass = getColorClass(value, colorThresholds, color);

  return (
    <div className={['w-full', className].join(' ')}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-xs text-text-secondary">{label}</span>}
          {showValue && (
            <span className="text-xs font-medium text-text-primary tabular-nums">
              {value.toFixed(1)}
            </span>
          )}
        </div>
      )}
      <div className={['w-full bg-surface-600 rounded-full overflow-hidden', sizeClasses[size]].join(' ')}>
        <div
          className={['h-full rounded-full transition-all duration-500', colorClass].join(' ')}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}
