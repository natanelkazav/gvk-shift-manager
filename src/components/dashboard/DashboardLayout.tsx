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

interface DashboardLayoutProps {
  children: (
    dashboard:
      NonNullable<
        ReturnType<
          typeof useDashboard
        >['dashboard']
      >,
  ) => ReactNode;
}

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