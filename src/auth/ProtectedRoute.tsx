import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { LoadingScreen } from '../components/ui';
import { useAuth } from './AuthContext';

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

  return <Outlet />;
}

export default ProtectedRoute;