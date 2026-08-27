type BadgeVariant =
  | 'normal'
  | 'review_required'
  | 'verified'
  | 'not_verified'
  | 'disputed'
  | 'active'
  | 'cold_start'
  | 'insufficient_data'
  | 'low'
  | 'medium'
  | 'high'
  | 'graded'
  | 'low_stakes'
  | 'default';

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  normal: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  review_required: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  verified: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  not_verified: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  disputed: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  cold_start: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  insufficient_data: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  high: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  graded: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
  low_stakes: 'bg-surface-600 text-text-secondary border-border-strong',
  default: 'bg-surface-600 text-text-secondary border-border-strong',
};

const dotClasses: Record<BadgeVariant, string> = {
  normal: 'bg-emerald-400',
  review_required: 'bg-amber-400',
  verified: 'bg-sky-400',
  not_verified: 'bg-rose-400',
  disputed: 'bg-rose-400',
  active: 'bg-emerald-400',
  cold_start: 'bg-amber-400',
  insufficient_data: 'bg-rose-400',
  low: 'bg-emerald-400',
  medium: 'bg-amber-400',
  high: 'bg-rose-400',
  graded: 'bg-indigo-400',
  low_stakes: 'bg-text-muted',
  default: 'bg-text-muted',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-1 gap-1.5',
};

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center font-medium rounded-full border',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {dot && (
        <span
          className={['w-1.5 h-1.5 rounded-full flex-shrink-0', dotClasses[variant]].join(' ')}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
