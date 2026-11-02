/**
 * קובץ: src/auth/PublicOnlyRoute.tsx
 * מטרה: ניהול מסלולים ציבוריים והפניית משתמש שכבר מחובר בהתאם לתנאים ברכיב.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PublicOnlyRoute.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  Navigate,
  Outlet,
} from 'react-router-dom';
import { LoadingScreen } from '../components/ui';
import { useAuth } from './AuthContext';

/**
 * פעולה PublicOnlyRoute: הנתון PublicOnlyRoute בהקשר הפעולה.
 */
function PublicOnlyRoute() {
  const {
    session,
    profile,
    isLoading,
  } = useAuth();

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isLoading.
  if (isLoading) {
    return <LoadingScreen />;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר session && profile.
  if (session && profile) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default PublicOnlyRoute;