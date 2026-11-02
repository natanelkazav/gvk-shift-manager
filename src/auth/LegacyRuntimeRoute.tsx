/**
 * קובץ: src/auth/LegacyRuntimeRoute.tsx
 * מטרה: בחירת התנהגות הניווט למסכים ותיקים בהתאם למצב המנגנון הדינמי.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: LegacyRuntimeRouteProps, LegacyRuntimeRoute.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { useEffect, useState } from 'react';
import { dynamicCutoverService } from '../services/dynamicCutoverService';

/**
 * חוזה הנתונים LegacyRuntimeRouteProps: מאפייני הרכיב.
 */
interface LegacyRuntimeRouteProps {
  redirectTo: string;
}

/**
 * Keeps legacy URLs alive for users that are still on Legacy-first, while
 * preventing Dynamic-first users from accidentally falling back into the old
 * workspaces through bookmarks, stale notifications or browser history.
 *
 * Recovery routes live under /legacy/* and intentionally do not use this
 * guard. They are protected separately for administrators/managers.
 */
/**
 * פעולה LegacyRuntimeRoute: הנתון LegacyRuntimeRoute בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function LegacyRuntimeRoute({ redirectTo }: LegacyRuntimeRouteProps) {
  const location = useLocation();
  // מצב מקומי: loading — טעינה; setLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [loading, setLoading] = useState(true);
  // מצב מקומי: useDynamicRuntime — דינמי; setUseDynamicRuntime מעדכנת אותו ומפעילה רינדור לפי React.
  const [useDynamicRuntime, setUseDynamicRuntime] = useState(false);
  // מצב מקומי: legacyFrozen — הנתון legacyFrozen בהקשר הפעולה; setLegacyFrozen מעדכנת אותו ומפעילה רינדור לפי React.
  const [legacyFrozen, setLegacyFrozen] = useState(false);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(() => {
    // active — פעיל.
    let active = true;

    void dynamicCutoverService
      .getState()
      .then((state) => {
        if (!active) return;
        setUseDynamicRuntime(state.useDynamicRuntime);
        setLegacyFrozen(state.legacyFrozen);
      })
      .catch(() => {
        if (!active) return;
        // A cutover-state failure must not lock a legacy-only user out of the
        // current production workflow. The route stays on Legacy in this case.
        setUseDynamicRuntime(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) return null;

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר useDynamicRuntime || legacyFrozen.
  if (useDynamicRuntime || legacyFrozen) {
    return (
      <Navigate
        to={redirectTo}
        replace
        state={{
          redirectedFromLegacy: true,
          attemptedPath: location.pathname,
        }}
      />
    );
  }

  return <Outlet />;
}

export default LegacyRuntimeRoute;
