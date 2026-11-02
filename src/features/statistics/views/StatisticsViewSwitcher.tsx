/**
 * קובץ: src/features/statistics/views/StatisticsViewSwitcher.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור סטטיסטיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: StatisticsDisplayMode, StatisticsViewSwitcherProps, StatisticsViewSwitcher.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  BarChart3,
  LayoutDashboard,
  Table2,
} from 'lucide-react';

/**
 * טיפוס StatisticsDisplayMode: סטטיסטיקה / מצב פעולה.
 */
export type StatisticsDisplayMode =
  | 'dashboard'
  | 'charts'
  | 'tables';

/**
 * חוזה הנתונים StatisticsViewSwitcherProps: סטטיסטיקה / מאפייני הרכיב.
 */
interface StatisticsViewSwitcherProps {
  // value — ערך.
  value:
    StatisticsDisplayMode;

  // onChange — פונקציית דיווח על שינוי.
  onChange: (
    value:
      StatisticsDisplayMode,
  ) => void;
}

/**
 * פעולה StatisticsViewSwitcher: סטטיסטיקה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function StatisticsViewSwitcher({
  value,
  onChange,
}: StatisticsViewSwitcherProps) {
  // options — אפשרויות בחירה.
  const options: Array<{
    // value — ערך.
    value:
      StatisticsDisplayMode;

    // label — תווית.
    label: string;

    icon:
      typeof LayoutDashboard;
  }> = [
    {
      value:
        'dashboard',

      label:
        'לוח סיכום',

      icon:
        LayoutDashboard,
    },
    {
      value:
        'charts',

      label:
        'גרפים',

      icon:
        BarChart3,
    },
    {
      value:
        'tables',

      label:
        'טבלאות',

      icon:
        Table2,
    },
  ];

  return (
    <div
      className="statistics-view-switcher"
      role="group"
      aria-label="בחירת תצוגת סטטיסטיקות"
    >
      {options.map(
        (
          option,
        ) => {
          const Icon =
            option.icon;

          // isActive — האם הרשומה פעילה.
          const isActive =
            value ===
            option.value;

          return (
            <button
              key={
                option.value
              }
              type="button"
              className={
                isActive
                  ? 'statistics-view-switcher-button statistics-view-switcher-button-active'
                  : 'statistics-view-switcher-button'
              }
              aria-pressed={
                isActive
              }
              onClick={() => {
                onChange(
                  option.value,
                );
              }}
            >
              <Icon
                size={17}
                aria-hidden="true"
              />

              {
                option.label
              }
            </button>
          );
        },
      )}
    </div>
  );
}

export default StatisticsViewSwitcher;