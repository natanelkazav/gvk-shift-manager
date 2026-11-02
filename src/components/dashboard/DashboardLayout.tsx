/**
 * קובץ: src/components/dashboard/DashboardLayout.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור לוח בקרה / פריסת מסך.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DashboardLayoutProps, DashboardLayout.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  AlertTriangle,
} from 'lucide-react';

import type {
  ReactNode,
} from 'react';

import {
  useAuth,
} from '../../auth/AuthContext';

import {
  useDashboard,
} from '../../hooks/useDashboard';

import DashboardHeader
  from './DashboardHeader';

import DashboardSkeleton
  from './DashboardSkeleton';

/**
 * חוזה הנתונים DashboardLayoutProps: לוח בקרה / פריסת מסך / מאפייני הרכיב.
 */
interface DashboardLayoutProps {
  // children — התוכן המקונן של הרכיב.
  children: (
    dashboard:
      NonNullable<
        ReturnType<
          typeof useDashboard
        >['dashboard']
      >,
  ) => ReactNode;
}

/**
 * פעולה DashboardLayout: לוח בקרה / פריסת מסך.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const {
    profile,
  } =
    useAuth();

  const {
    dashboard,
    isLoading,
    isRefreshing,
    error,
    refresh,
    clearError,
  } =
    useDashboard();

  return (
    <div className="dashboard-page">
      <DashboardHeader
        profile={
          profile
        }
        isRefreshing={
          isRefreshing
        }
        onRefresh={
          refresh
        }
      />

      {error ? (
        <div
          className="dashboard-error"
          role="alert"
        >
          <AlertTriangle
            size={20}
            aria-hidden="true"
          />

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={
              clearError
            }
            aria-label="סגירת הודעת השגיאה"
          >
            ×
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <DashboardSkeleton />
      ) : null}

      {!isLoading &&
      dashboard ? (
        children(
          dashboard,
        )
      ) : null}
    </div>
  );
}

export default DashboardLayout;