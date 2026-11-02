/**
 * קובץ: src/pages/DashboardPage.tsx
 * מטרה: מימוש מסך המשתמש עבור לוח בקרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DashboardLocationState, DashboardPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * חוזה הנתונים DashboardLocationState: לוח בקרה / מצב.
 */
interface DashboardLocationState {
  accessDenied?: boolean;

  // attemptedPath — נתיב (אופציונלי).
  attemptedPath?:
    string;
}

/**
 * פעולה DashboardPage: לוח בקרה.
 */
function DashboardPage() {
  const location =
    useLocation();

  const navigate =
    useNavigate();

  // locationState — מצב.
  const locationState =
    location.state as
      | DashboardLocationState
      | null;

  // מצב מקומי: dynamicContext — דינמי; setDynamicContext מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    dynamicContext,
    setDynamicContext,
  ] = useState<DynamicRuntimeContext | null>(null);
  // מצב מקומי: dynamicFirstActive — דינמי / פעיל; setDynamicFirstActive מעדכנת אותו ומפעילה רינדור לפי React.
  const [dynamicFirstActive, setDynamicFirstActive] = useState(false);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(() => {
    // active — פעיל.
    let active = true;
    void Promise.all([dynamicRuntimeService.getMyRuntimeContext(), dynamicCutoverService.getState()])
      .then(([context, cutover]) => {
        if (!active) return;
        // canUseDynamicManagement — דינמי.
        const canUseDynamicManagement =
          context.canManageDynamicScheduling ||
          context.managedRoles.length > 0;
        setDynamicContext(context);
        setDynamicFirstActive(
          cutover.dynamicFirstEnabled &&
          (cutover.useDynamicRuntime || canUseDynamicManagement),
        );
      })
      .catch(() => {
        if (active) { setDynamicContext(null); setDynamicFirstActive(false); }
      });
    return () => { active = false; };
  }, []);

  // מצב מקומי: accessDeniedMessage — הודעה; setAccessDeniedMessage מעדכנת אותו ומפעילה רינדור לפי React.
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

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ location.pathname, locationState ?.accessDenied, navigate, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !locationState ?.accessDenied.
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
          // The active dashboard follows the same Dynamic-first boundary as
          // the application shell. Employees enter through an active Job Type
          // membership; Job Type managers can use the management dashboard
          // without also being employee members of a managed role.
          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dynamicFirstActive && dynamicContext && ( dynamicContext.hasDynamicMemberships || dynamicContext.canManageDynamicScheduling || dynamicContex.
          if (
            dynamicFirstActive &&
            dynamicContext &&
            (
              dynamicContext.hasDynamicMemberships ||
              dynamicContext.canManageDynamicScheduling ||
              dynamicContext.managedRoles.length > 0
            )
          ) {
            return (
              <DynamicDashboard
                context={dynamicContext}
              />
            );
          }

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dashboard.manager.
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

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dashboard.dispatcher.
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

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dashboard.driver.
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

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר dashboard.morningDriver.
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