/**
 * קובץ: src/auth/StatisticsAccessRoute.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור סטטיסטיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: StatisticsAccessRoute.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { activityTrackingService } from '../services/activityTrackingService';

/**
 * פעולה StatisticsAccessRoute: סטטיסטיקה.
 */
export default function StatisticsAccessRoute() {
  const location = useLocation();
  const { hasPermission, isLoading, permissionsLoaded } = useAuth();
  // מצב מקומי: canViewOwn — האם צפייה מותרת; setCanViewOwn מעדכנת אותו ומפעילה רינדור לפי React.
  const [canViewOwn, setCanViewOwn] = useState<boolean | null>(null);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [hasPermission, isLoading, permissionsLoaded].
  useEffect(() => {
    if (isLoading || !permissionsLoaded || hasPermission('statistics.view')) return;
    // active — פעיל.
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
