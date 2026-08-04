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

interface PermissionRouteProps {
  permission?:
    PermissionKey;

  anyPermissions?:
    PermissionKey[];
}

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

    if (
      isLoading ||
      !permissionsLoaded
    ) {
      return null;
    }
  const normalizedAnyPermissions =
    anyPermissions ?? [];

  const hasSinglePermission =
    permission
      ? hasPermission(
          permission,
        )
      : false;

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

  const hasAccess =
    hasSinglePermission ||
    hasAnyPermission;

  const hasPermissionRequirement =
    Boolean(
      permission ||
      normalizedAnyPermissions
        .length > 0,
    );

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