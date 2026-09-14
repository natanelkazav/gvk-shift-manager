import { useEffect } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { clientVersionService } from '../../../services/clientVersionService';

const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;

export default function AppVersionReporter() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    const report = async (): Promise<void> => {
      if (cancelled || !navigator.onLine) return;
      try {
        await clientVersionService.reportCurrentClient();
      } catch (error) {
        console.warn('Client version heartbeat failed:', error);
      }
    };

    void report();
    const intervalId = window.setInterval(() => void report(), HEARTBEAT_INTERVAL_MS);
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
