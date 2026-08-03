import {
  useEffect,
  useState,
} from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import DashboardLayout
  from '../components/dashboard/DashboardLayout';

import DispatcherDashboard
  from '../components/dashboard/DispatcherDashboard';

import DriverDashboard
  from '../components/dashboard/DriverDashboard';

import ManagerDashboard
  from '../components/dashboard/ManagerDashboard';

import '../styles/dashboard.css';

interface DashboardLocationState {
  accessDenied?: boolean;

  attemptedPath?:
    string;
}

function DashboardPage() {
  const location =
    useLocation();

  const navigate =
    useNavigate();

  const locationState =
    location.state as
      | DashboardLocationState
      | null;

  const [
    accessDeniedMessage,
    setAccessDeniedMessage,
  ] =
    useState<string | null>(
      locationState
        ?.accessDenied
        ? 'אין לך הרשאה לגשת למסך זה.'
        : null,
    );

  useEffect(
    () => {
      if (
        !locationState
          ?.accessDenied
      ) {
        return;
      }

      navigate(
        location.pathname,
        {
          replace: true,
          state: null,
        },
      );
    },
    [
      location.pathname,
      locationState
        ?.accessDenied,
      navigate,
    ],
  );

  return (
    <>
      {accessDeniedMessage ? (
        <div
          className="dashboard-error"
          role="alert"
        >
          <span>
            {
              accessDeniedMessage
            }
          </span>

          <button
            type="button"
            onClick={() => {
              setAccessDeniedMessage(
                null,
              );
            }}
            aria-label="סגירת הודעת הרשאה"
          >
            ×
          </button>
        </div>
      ) : null}

      <DashboardLayout>
        {(
          dashboard,
        ) => {
          if (
            dashboard.manager
          ) {
            return (
              <ManagerDashboard
                data={
                  dashboard.manager
                }
              />
            );
          }

          if (
            dashboard.dispatcher
          ) {
            return (
              <DispatcherDashboard
                data={
                  dashboard.dispatcher
                }
              />
            );
          }

          if (
            dashboard.driver
          ) {
            return (
              <DriverDashboard
                data={
                  dashboard.driver
                }
              />
            );
          }

          return (
            <section className="dashboard-card">
              <div className="dashboard-card-body">
                <p className="dashboard-empty-text">
                  אין מידע להצגה עבור
                  המשתמש הנוכחי.
                </p>
              </div>
            </section>
          );
        }}
      </DashboardLayout>
    </>
  );
}

export default DashboardPage;