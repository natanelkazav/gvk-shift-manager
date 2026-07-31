import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { LoadingScreen } from '../components/ui';
import { useAuth } from './AuthContext';

const CHANGE_PASSWORD_PATH =
  '/change-password';

function ProtectedRoute() {
  const location = useLocation();

  const {
    session,
    profile,
    isLoading,
  } = useAuth();

  if (isLoading) {
    return (
      <LoadingScreen message="בודק את פרטי ההתחברות..." />
    );
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

  const isChangePasswordPage =
    location.pathname ===
    CHANGE_PASSWORD_PATH;

  if (
    profile.mustChangePassword &&
    !isChangePasswordPage
  ) {
    return (
      <Navigate
        to={CHANGE_PASSWORD_PATH}
        replace
      />
    );
  }

  if (
    !profile.mustChangePassword &&
    isChangePasswordPage
  ) {
    return (
      <Navigate
        to="/"
        replace
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;