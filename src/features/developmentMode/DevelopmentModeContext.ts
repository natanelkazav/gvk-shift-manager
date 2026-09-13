import { createContext, useContext } from 'react';
import type { DevelopmentModeState } from '../../services/developmentModeService';

export interface DevelopmentModeContextValue extends DevelopmentModeState {
  isLoading: boolean;
  refresh: () => Promise<void>;
  setEnabled: (enabled: boolean, durationMinutes?: number | null) => Promise<void>;
}

export const DevelopmentModeContext = createContext<DevelopmentModeContextValue | null>(null);

export function useDevelopmentMode(): DevelopmentModeContextValue {
  const value = useContext(DevelopmentModeContext);
  if (!value) throw new Error('useDevelopmentMode must be used inside DevelopmentModeProvider.');
  return value;
}
