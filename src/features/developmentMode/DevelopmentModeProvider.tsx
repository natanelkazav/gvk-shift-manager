/**
 * קובץ: src/features/developmentMode/DevelopmentModeProvider.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור מצב פיתוח / מצב פעולה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DevelopmentModeProvider.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { developmentModeService, type DevelopmentModeState } from '../../services/developmentModeService';
import { DevelopmentModeContext } from './DevelopmentModeContext';

// emptyState — מצב.
const emptyState: DevelopmentModeState = { enabled: false, expiresAt: null, enabledAt: null };

/**
 * פעולה DevelopmentModeProvider: מצב פיתוח / מצב פעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
export function DevelopmentModeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [state, setState] = useState<DevelopmentModeState>(emptyState);
  // מצב מקומי: isLoading — האם טעינה מתבצעת; setIsLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [isLoading, setIsLoading] = useState(false);
  // isSystemAdmin — הנתון isSystemAdmin בהקשר הפעולה.
  const isSystemAdmin = profile?.role === 'admin';

  const refresh = useCallback(async () => {
    if (!isSystemAdmin) return;
    setIsLoading(true);
    try { setState(await developmentModeService.getState()); }
    finally { setIsLoading(false); }
  }, [isSystemAdmin]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [isSystemAdmin].
  useEffect(() => {
    if (!isSystemAdmin) return;
    let cancelled = false;
    void developmentModeService.getState().then((nextState) => {
      if (!cancelled) setState(nextState);
    });
    return () => { cancelled = true; };
  }, [isSystemAdmin]);

  // setEnabled — קבוצה ייחודית / האם האפשרות מופעלת.
  const setEnabled = useCallback(async (enabled: boolean, durationMinutes: number | null = 60) => {
    if (!isSystemAdmin) throw new Error('מצב פיתוח זמין למנהלי מערכת בלבד.');
    setIsLoading(true);
    try { setState(await developmentModeService.setState(enabled, enabled ? durationMinutes : null)); }
    finally { setIsLoading(false); }
  }, [isSystemAdmin]);

  // ערך מחושב value — ערך; נשמר בין רינדורים עד שינוי התלויות.
  const value = useMemo(() => ({ ...(isSystemAdmin ? state : emptyState), isLoading, refresh, setEnabled }), [isSystemAdmin, state, isLoading, refresh, setEnabled]);
  return <DevelopmentModeContext.Provider value={value}>{children}</DevelopmentModeContext.Provider>;
}
