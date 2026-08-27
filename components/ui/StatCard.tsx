interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number; // positive = up, negative = down
    label: string;
  };
  accent?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky';
  className?: string;
}

const accentBg: Record<NonNullable<StatCardProps['accent']>, string> = {
  indigo: 'bg-indigo-500/10 text-indigo-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  amber: 'bg-amber-500/10 text-amber-400',
  rose: 'bg-rose-500/10 text-rose-400',
  sky: 'bg-sky-500/10 text-sky-400',
};

const accentBorder: Record<NonNullable<StatCardProps['accent']>, string> = {
  indigo: 'border-indigo-500/20',
  emerald: 'border-emerald-500/20',
  amber: 'border-amber-500/20',
  rose: 'border-rose-500/20',
  sky: 'border-sky-500/20',
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  accent = 'indigo',
  className = '',
}: StatCardProps) {
  const trendPositive = trend && trend.value > 0;
  const trendNegative = trend && trend.value < 0;

  return (
    <div
      className={[
        'rounded-xl bg-surface-800 border p-5',
        'shadow-lg shadow-black/20',
        accentBorder[accent],
        className,
      ].join(' ')}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-text-primary mt-1 tabular-nums">{value}</p>
          {subtitle && (
            <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={[
                  'text-xs font-medium',
                  trendPositive ? 'text-emerald-400' : trendNegative ? 'text-rose-400' : 'text-text-muted',
                ].join(' ')}
              >
                {trendPositive ? '↑' : trendNegative ? '↓' : '→'}{' '}
                {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-text-muted">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={['p-2.5 rounded-lg flex-shrink-0', accentBg[accent]].join(' ')}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
