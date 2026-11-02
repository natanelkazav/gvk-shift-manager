/**
 * קובץ: src/components/ui/LoadingScreen.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור טעינה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: LoadingScreenProps, LoadingScreen.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
/**
 * חוזה הנתונים LoadingScreenProps: טעינה / מאפייני הרכיב.
 */
interface LoadingScreenProps {
  // message — הודעה (אופציונלי).
  message?: string;
}

/**
 * פעולה LoadingScreen: טעינה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function LoadingScreen({
  message = 'טוען את המערכת...',
}: LoadingScreenProps) {
  return (
    <div
      className="loading-screen"
      role="status"
      aria-live="polite"
    >
      <div
        className="loading-spinner"
        aria-hidden="true"
      />

      <p>{message}</p>
    </div>
  );
}

export default LoadingScreen;