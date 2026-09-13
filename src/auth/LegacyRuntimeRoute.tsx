import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { useEffect, useState } from 'react';
import { dynamicCutoverService } from '../services/dynamicCutoverService';

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
function LegacyRuntimeRoute({ redirectTo }: LegacyRuntimeRouteProps) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [useDynamicRuntime, setUseDynamicRuntime] = useState(false);
  const [legacyFrozen, setLegacyFrozen] = useState(false);

  useEffect(() => {
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
