import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { activityTrackingService } from '../services/activityTrackingService';

export default function StatisticsAccessRoute() {
  const location = useLocation();
  const { hasPermission, isLoading, permissionsLoaded } = useAuth();
  const [canViewOwn, setCanViewOwn] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoading || !permissionsLoaded || hasPermission('statistics.view')) return;
    let active = true;
    void activityTrackingService.canViewOwnStatistics()
      .then((value) => { if (active) setCanViewOwn(value); })
      .catch(() => { if (active) setCanViewOwn(false); });
    return () => { active = false; };
  }, [hasPermission, isLoading, permissionsLoaded]);

  if (isLoading || !permissionsLoaded) return null;
  if (hasPermission('statistics.view')) return <Outlet />;
  if (canViewOwn === null) return null;
  if (canViewOwn) return <Outlet />;
  return <Navigate to="/" replace state={{ accessDenied: true, attemptedPath: location.pathname }} />;
}
