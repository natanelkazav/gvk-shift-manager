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

import MorningDriverDashboard
  from '../components/dashboard/MorningDriverDashboard';

import DynamicDashboard
  from '../components/dashboard/DynamicDashboard';

import { dynamicRuntimeService }
  from '../services/dynamicRuntimeService';
import { dynamicCutoverService } from '../services/dynamicCutoverService';

import type { DynamicRuntimeContext }
  from '../types/dynamicRuntime';

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
    dynamicContext,
    setDynamicContext,
  ] = useState<DynamicRuntimeContext | null>(null);
  const [useDynamicRuntime, setUseDynamicRuntime] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([dynamicRuntimeService.getMyRuntimeContext(), dynamicCutoverService.getState()])
      .then(([context, cutover]) => {
        if (active) { setDynamicContext(context); setUseDynamicRuntime(cutover.useDynamicRuntime); }
      })
      .catch(() => {
        if (active) { setDynamicContext(null); setUseDynamicRuntime(false); }
      });
    return () => { active = false; };
  }, []);

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
          // Dynamic-first: once the user has at least one active dynamic
          // membership, the dashboard is derived from Job Types rather than
          // the legacy profile.role. Legacy remains available only as a
          // transition fallback for users not migrated yet.
          if (useDynamicRuntime && dynamicContext?.hasDynamicMemberships) {
            return (
              <DynamicDashboard
                context={dynamicContext}
              />
            );
          }

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

          if (
            dashboard.morningDriver
          ) {
            return (
              <MorningDriverDashboard
                data={
                  dashboard.morningDriver
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