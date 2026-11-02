/**
 * קובץ: src/auth/ProtectedRoute.tsx
 * מטרה: הגבלת כניסה למסלול בממשק בהתאם למצב ההתחברות ולתנאי הגישה המוגדרים ברכיב.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ProtectedRoute.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { LoadingScreen } from '../components/ui';
import { useAuth } from './AuthContext';

// CHANGE_PASSWORD_PATH — סיסמה / נתיב.
const CHANGE_PASSWORD_PATH =
  '/change-password';

/**
 * פעולה ProtectedRoute: הנתון ProtectedRoute בהקשר הפעולה.
 */
function ProtectedRoute() {
  const location = useLocation();

  const {
    session,
    profile,
    isLoading,
  } = useAuth();

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isLoading.
  if (isLoading) {
    return (
      <LoadingScreen message="בודק את פרטי ההתחברות..." />
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !session || !profile.
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

  // isChangePasswordPage — סיסמה.
  const isChangePasswordPage =
    location.pathname ===
    CHANGE_PASSWORD_PATH;

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר profile.mustChangePassword && !isChangePasswordPage.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !profile.mustChangePassword && isChangePasswordPage.
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