/**
 * קובץ: src/auth/PermissionRoute.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור הרשאות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PermissionRouteProps, PermissionRoute.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';

import {
  useAuth,
} from './AuthContext';

import type {
  PermissionKey,
} from '../types/auth';

/**
 * חוזה הנתונים PermissionRouteProps: הרשאות / מאפייני הרכיב.
 */
interface PermissionRouteProps {
  // permission — הרשאות (אופציונלי).
  permission?:
    PermissionKey;

  // anyPermissions — הרשאות (אופציונלי).
  anyPermissions?:
    PermissionKey[];
}

/**
 * פעולה PermissionRoute: הרשאות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function PermissionRoute({
  permission,
  anyPermissions,
}: PermissionRouteProps) {
  const location =
    useLocation();

    const {
      hasPermission,
      isLoading,
      permissionsLoaded,
    } =
      useAuth();

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isLoading || !permissionsLoaded.
    if (
      isLoading ||
      !permissionsLoaded
    ) {
      return null;
    }
  // normalizedAnyPermissions — הרשאות.
  const normalizedAnyPermissions =
    anyPermissions ?? [];

  // hasSinglePermission — הרשאות.
  const hasSinglePermission =
    permission
      ? hasPermission(
          permission,
        )
      : false;

  // hasAnyPermission — הרשאות.
  const hasAnyPermission =
    normalizedAnyPermissions
      .some(
        (
          currentPermission,
        ) =>
          hasPermission(
            currentPermission,
          ),
      );

  // hasAccess — הנתון hasAccess בהקשר הפעולה.
  const hasAccess =
    hasSinglePermission ||
    hasAnyPermission;

  // hasPermissionRequirement — הרשאות.
  const hasPermissionRequirement =
    Boolean(
      permission ||
      normalizedAnyPermissions
        .length > 0,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !hasPermissionRequirement || !hasAccess.
  if (
    !hasPermissionRequirement ||
    !hasAccess
  ) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          accessDenied:
            true,

          attemptedPath:
            location.pathname,
        }}
      />
    );
  }

  return <Outlet />;
}

export default PermissionRoute;