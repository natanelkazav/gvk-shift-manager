/**
 * קובץ: src/components/dashboard/DashboardCard.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור לוח בקרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DashboardCardProps, DashboardCard.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import type {
  ReactNode,
} from 'react';

/**
 * חוזה הנתונים DashboardCardProps: לוח בקרה / מאפייני הרכיב.
 */
interface DashboardCardProps {
  // title — כותרת.
  title: string;

  icon?: ReactNode;

  badge?: ReactNode;

  // children — התוכן המקונן של הרכיב.
  children: ReactNode;

  footer?: ReactNode;

  // className — שם (אופציונלי).
  className?: string;
}

/**
 * פעולה DashboardCard: לוח בקרה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DashboardCard({
  title,
  icon,
  badge,
  children,
  footer,
  className,
}: DashboardCardProps) {
  return (
    <section
      className={[
        'dashboard-card',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="dashboard-card-header">
        <div className="dashboard-card-title-wrap">
          {icon ? (
            <span className="dashboard-card-icon">
              {icon}
            </span>
          ) : null}

          <h2>
            {title}
          </h2>
        </div>

        {badge ? (
          <div className="dashboard-card-badge">
            {badge}
          </div>
        ) : null}
      </header>

      <div className="dashboard-card-body">
        {children}
      </div>

      {footer ? (
        <footer className="dashboard-card-footer">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

export default DashboardCard;