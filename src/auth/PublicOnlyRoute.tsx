import {
  Navigate,
  Outlet,
} from 'react-router-dom';
import { LoadingScreen } from '../components/ui';
import { useAuth } from './AuthContext';

function PublicOnlyRoute() {
  const {
    session,
    profile,
    isLoading,
  } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (session && profile) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default PublicOnlyRoute;