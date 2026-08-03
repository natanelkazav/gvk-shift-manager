import {
  BarChart3,
  LayoutDashboard,
  Table2,
} from 'lucide-react';

export type StatisticsDisplayMode =
  | 'dashboard'
  | 'charts'
  | 'tables';

interface StatisticsViewSwitcherProps {
  value:
    StatisticsDisplayMode;

  onChange: (
    value:
      StatisticsDisplayMode,
  ) => void;
}

function StatisticsViewSwitcher({
  value,
  onChange,
}: StatisticsViewSwitcherProps) {
  const options: Array<{
    value:
      StatisticsDisplayMode;

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