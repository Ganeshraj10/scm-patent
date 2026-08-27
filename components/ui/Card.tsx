import { forwardRef } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  noBorder?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      header,
      footer,
      children,
      padding = 'md',
      noBorder = false,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={[
          'rounded-xl bg-surface-800',
          noBorder ? '' : 'border border-border',
          'shadow-lg shadow-black/20',
          className,
        ].join(' ')}
        {...props}
      >
        {header && (
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            {header}
          </div>
        )}
        <div className={paddingClasses[padding]}>{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-border">{footer}</div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';

// ─── Card sub-components ─────────────────────────────────────

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between w-full">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle && (
          <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
