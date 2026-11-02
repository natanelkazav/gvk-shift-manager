/**
 * קובץ: src/components/availability/AvailabilityManagementStats.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityManagementStat, AvailabilityManagementStatsProps, AvailabilityManagementStats.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  type LucideIcon,
} from 'lucide-react';

/**
 * חוזה הנתונים AvailabilityManagementStat: אילוצים וזמינות.
 */
interface AvailabilityManagementStat {
  // label — תווית.
  label: string;
  // value — ערך.
  value: number | string;
  icon: LucideIcon;
}

/**
 * חוזה הנתונים AvailabilityManagementStatsProps: אילוצים וזמינות / מאפייני הרכיב.
 */
interface AvailabilityManagementStatsProps {
  // items — פריטים.
  items:
    AvailabilityManagementStat[];
}

/**
 * פעולה AvailabilityManagementStats: אילוצים וזמינות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function AvailabilityManagementStats({
  items,
}: AvailabilityManagementStatsProps) {
  return (
    <div className="availability-management-stats">
      {items.map(
        (
          item,
        ) => {
          const Icon =
            item.icon;

          return (
            <article
              key={
                item.label
              }
            >
              <Icon
                size={21}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {item.value}
                </strong>

                <span>
                  {item.label}
                </span>
              </div>
            </article>
          );
        },
      )}
    </div>
  );
}

export default AvailabilityManagementStats;
