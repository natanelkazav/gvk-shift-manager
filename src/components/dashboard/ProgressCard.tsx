/**
 * קובץ: src/components/dashboard/ProgressCard.tsx
 * מטרה: הצגת מדד התקדמות בכרטיס לוח בקרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ProgressCardProps, normalizePercentage, ProgressCard.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  BarChart3,
} from 'lucide-react';

import DashboardCard
  from './DashboardCard';

/**
 * חוזה הנתונים ProgressCardProps: מאפייני הרכיב.
 */
interface ProgressCardProps {
  // title — כותרת.
  title: string;

  completed: number;

  // total — סך הכול.
  total: number;

  percentage: number;

  // unitLabel — תווית.
  unitLabel: string;
}

/**
 * פעולה normalizePercentage: נרמול הנתון normalizePercentage בהקשר הפעולה.
 * @param value — ערך.
 * @returns number — הפלט בהתאם לחתימה.
 */
function normalizePercentage(
  value: number,
): number {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Number.isFinite( value, ).
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      value,
    ),
  );
}

/**
 * פעולה ProgressCard: הנתון ProgressCard בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function ProgressCard({
  title,
  completed,
  total,
  percentage,
  unitLabel,
}: ProgressCardProps) {
  // normalizedPercentage — הנתון normalizedPercentage בהקשר הפעולה.
  const normalizedPercentage =
    normalizePercentage(
      percentage,
    );

  return (
    <DashboardCard
      title={
        title
      }
      icon={
        <BarChart3
          size={20}
          aria-hidden="true"
        />
      }
    >
      <div className="dashboard-progress-card">
        <div className="dashboard-progress-summary">
          <strong>
            {normalizedPercentage.toFixed(
              normalizedPercentage %
                1 ===
                0
                ? 0
                : 1,
            )}
            %
          </strong>

          <span>
            {completed} מתוך {total}{' '}
            {unitLabel}
          </span>
        </div>

        <div
          className="dashboard-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={
            normalizedPercentage
          }
        >
          <span
            style={{
              width:
                `${normalizedPercentage}%`,
            }}
          />
        </div>
      </div>
    </DashboardCard>
  );
}

export default ProgressCard;