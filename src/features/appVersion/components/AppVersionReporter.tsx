/**
 * קובץ: src/features/appVersion/components/AppVersionReporter.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור גרסה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AppVersionReporter.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { useEffect } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { clientVersionService } from '../../../services/clientVersionService';

// HEARTBEAT_INTERVAL_MS — מרווח זמן.
const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;

/**
 * פעולה AppVersionReporter: גרסה.
 */
export default function AppVersionReporter() {
  const { user } = useAuth();

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [user?.id].
  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    /**
     * פעולה אסינכרונית report: דוח.
     * @returns Promise<void> — הפלט בהתאם לחתימה.
     */
    const report = async (): Promise<void> => {
      if (cancelled || !navigator.onLine) return;
      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await clientVersionService.reportCurrentClient();
      } catch (error) {
        console.warn('Client version heartbeat failed:', error);
      }
    };

    void report();
    // intervalId — מרווח זמן / מזהה.
    const intervalId = window.setInterval(() => void report(), HEARTBEAT_INTERVAL_MS);
    /**
     * פעולה handleVisibility: טיפול באירוע עבור הנתון handleVisibility בהקשר הפעולה.
     * @returns void — הפלט בהתאם לחתימה.
     */
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') void report();
    };
    window.addEventListener('online', report);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('online', report);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id]);

  return null;
}
