import {
  CalendarCog,
  CalendarDays,
  ClipboardCheck,
  SlidersHorizontal,
} from 'lucide-react';

export type AvailabilityWorkspaceTab =
  | 'my-availability'
  | 'period-management'
  | 'submissions'
  | 'schedule-preparation';

interface AvailabilityWorkspaceTabsProps {
  activeTab:
    AvailabilityWorkspaceTab;

  canSubmitAvailability: boolean;
  canManageAvailability: boolean;
  canPrepareSchedule: boolean;

  onChange: (
    tab: AvailabilityWorkspaceTab,
  ) => void;
}

interface AvailabilityTabDefinition {
  id:
    AvailabilityWorkspaceTab;

  label: string;
  description: string;

  icon:
    typeof CalendarDays;

  isVisible: boolean;
}

function AvailabilityWorkspaceTabs({
  activeTab,
  canSubmitAvailability,
  canManageAvailability,
  canPrepareSchedule,
  onChange,
}: AvailabilityWorkspaceTabsProps) {
  const tabs:
    AvailabilityTabDefinition[] = [
      {
        id:
          'my-availability',

        label:
          'האילוצים שלי',

        description:
          'סימון זמינות והגשת אילוצים',

        icon:
          CalendarDays,

        isVisible:
          canSubmitAvailability,
      },

      {
        id:
          'period-management',

        label:
          'ניהול חודשים',

        description:
          'יצירה, פתיחה וניהול תקופות',

        icon:
          CalendarCog,

        isVisible:
          canManageAvailability,
      },

      {
        id:
          'submissions',

        label:
          'מעקב הגשות',

        description:
          'סטטוס מוקדנים ומטריצת זמינות',

        icon:
          ClipboardCheck,

        isVisible:
          canManageAvailability,
      },

      {
        id:
          'schedule-preparation',

        label:
          'הכנה לשיבוץ',

        description:
          'ניתוח אילוצים ויצירת טיוטה',

        icon:
          SlidersHorizontal,

        isVisible:
          canPrepareSchedule,
      },
    ];

  const visibleTabs =
    tabs.filter(
      (tab) =>
        tab.isVisible,
    );

  if (
    visibleTabs.length <= 1
  ) {
    return null;
  }

  return (
    <nav
      className="availability-workspace-tabs"
      aria-label="אזורי אילוצי מוקדנים"
    >
      {visibleTabs.map(
        (tab) => {
          const Icon =
            tab.icon;

          const isActive =
            activeTab ===
            tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              className={[
                'availability-workspace-tab',
                isActive
                  ? 'availability-workspace-tab-active'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={
                isActive
                  ? 'page'
                  : undefined
              }
              onClick={() => {
                onChange(
                  tab.id,
                );
              }}
            >
              <span className="availability-workspace-tab-icon">
                <Icon
                  size={20}
                  aria-hidden="true"
                />
              </span>

              <span className="availability-workspace-tab-content">
                <strong>
                  {tab.label}
                </strong>

                <small>
                  {tab.description}
                </small>
              </span>
            </button>
          );
        },
      )}
    </nav>
  );
}

export default AvailabilityWorkspaceTabs;