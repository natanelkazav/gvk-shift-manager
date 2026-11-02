/**
 * קובץ: src/components/ui/Badge.tsx
 * מטרה: תגית מצב קומפקטית עם מאפייני העיצוב המוגדרים ברכיב.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: BadgeVariant, BadgeProps, Badge.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import type { HTMLAttributes, ReactNode } from 'react';

/**
 * טיפוס BadgeVariant: הנתון BadgeVariant בהקשר הפעולה.
 */
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info';

/**
 * חוזה הנתונים BadgeProps: מאפייני הרכיב.
 */
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  // children — התוכן המקונן של הרכיב.
  children: ReactNode;
  variant?: BadgeVariant;
}

/**
 * פעולה Badge: הנתון Badge בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function Badge({
  children,
  variant = 'info',
  className = '',
  ...spanProps
}: BadgeProps) {
  // badgeClassName — שם.
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
