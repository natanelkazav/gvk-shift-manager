import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { developmentModeService, type DevelopmentModeState } from '../../services/developmentModeService';
import { DevelopmentModeContext } from './DevelopmentModeContext';

const emptyState: DevelopmentModeState = { enabled: false, expiresAt: null, enabledAt: null };

export function DevelopmentModeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [state, setState] = useState<DevelopmentModeState>(emptyState);
  const [isLoading, setIsLoading] = useState(false);
  const isSystemAdmin = profile?.role === 'admin';

  const refresh = useCallback(async () => {
    if (!isSystemAdmin) return;
    setIsLoading(true);
    try { setState(await developmentModeService.getState()); }
    finally { setIsLoading(false); }
  }, [isSystemAdmin]);

  useEffect(() => {
    if (!isSystemAdmin) return;
    let cancelled = false;
    void developmentModeService.getState().then((nextState) => {
      if (!cancelled) setState(nextState);
    });
    return () => { cancelled = true; };
  }, [isSystemAdmin]);

  const setEnabled = useCallback(async (enabled: boolean, durationMinutes: number | null = 60) => {
    if (!isSystemAdmin) throw new Error('מצב פיתוח זמין למנהלי מערכת בלבד.');
    setIsLoading(true);
    try { setState(await developmentModeService.setState(enabled, enabled ? durationMinutes : null)); }
    finally { setIsLoading(false); }
  }, [isSystemAdmin]);

  const value = useMemo(() => ({ ...(isSystemAdmin ? state : emptyState), isLoading, refresh, setEnabled }), [isSystemAdmin, state, isLoading, refresh, setEnabled]);
  return <DevelopmentModeContext.Provider value={value}>{children}</DevelopmentModeContext.Provider>;
}
