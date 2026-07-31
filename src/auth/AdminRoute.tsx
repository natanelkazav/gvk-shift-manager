import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { useAuth } from './AuthContext';

function AdminRoute() {
  const location = useLocation();

  const {
    session,
    profile,
    isLoading,
  } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!session || !profile) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  if (profile.role !== 'admin') {
    return (
      <Navigate
        to="/"
        replace
        state={{
          accessDenied: true,
          attemptedPath:
            location.pathname,
        }}
      />
    );
  }

  return <Outlet />;
}

export default AdminRoute;