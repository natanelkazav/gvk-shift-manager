import type { HTMLAttributes, ReactNode } from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
}

function Badge({
  children,
  variant = 'info',
  className = '',
  ...spanProps
}: BadgeProps) {
  const badgeClassName = [
    'badge',
    `badge-${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      className={badgeClassName}
      {...spanProps}
    >
      {children}
    </span>
  );
}

export default Badge;
