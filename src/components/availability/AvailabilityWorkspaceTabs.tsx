/**
 * קובץ: src/components/availability/AvailabilityWorkspaceTabs.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור אילוצים וזמינות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityWorkspaceTab, AvailabilityWorkspaceTabsProps, AvailabilityTabDefinition, AvailabilityWorkspaceTabs.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CalendarCog,
  CalendarDays,
  ClipboardCheck,
  SlidersHorizontal,
} from 'lucide-react';

/**
 * טיפוס AvailabilityWorkspaceTab: אילוצים וזמינות.
 */
export type AvailabilityWorkspaceTab =
  | 'my-availability'
  | 'period-management'
  | 'submissions'
  | 'schedule-preparation';

/**
 * חוזה הנתונים AvailabilityWorkspaceTabsProps: אילוצים וזמינות / מאפייני הרכיב.
 */
interface AvailabilityWorkspaceTabsProps {
  // activeTab — פעיל.
  activeTab:
    AvailabilityWorkspaceTab;

  // canSubmitAvailability — אילוצים וזמינות.
  canSubmitAvailability: boolean;
  // canManageAvailability — האם פעולת ניהול מותרת.
  canManageAvailability: boolean;
  // canPrepareSchedule — שיבוץ.
  canPrepareSchedule: boolean;

  // onChange — פונקציית דיווח על שינוי.
  onChange: (
    tab: AvailabilityWorkspaceTab,
  ) => void;
}

/**
 * חוזה הנתונים AvailabilityTabDefinition: אילוצים וזמינות.
 */
interface AvailabilityTabDefinition {
  // id — מזהה.
  id:
    AvailabilityWorkspaceTab;

  // label — תווית.
  label: string;
  description: string;

  icon:
    typeof CalendarDays;

  isVisible: boolean;
}

/**
 * פעולה AvailabilityWorkspaceTabs: אילוצים וזמינות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר visibleTabs.length <= 1.
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

          // isActive — האם הרשומה פעילה.
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