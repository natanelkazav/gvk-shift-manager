import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { useAuth } from './AuthContext';
import type {
  PermissionKey,
} from '../types/auth';

interface PermissionRouteProps {
  permission: PermissionKey;
}

function PermissionRoute({
  permission,
}: PermissionRouteProps) {
  const location = useLocation();

  const {
    hasPermission,
    isLoading,
  } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!hasPermission(permission)) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          accessDenied: true,
          attemptedPath: location.pathname,
        }}
      />
    );
  }

  return <Outlet />;
}

export default PermissionRoute;