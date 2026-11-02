/**
 * קובץ: src/features/developmentMode/DevelopmentModeContext.ts
 * מטרה: מימוש מצב פיתוח / מצב פעולה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DevelopmentModeContextValue, useDevelopmentMode.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import { createContext, useContext } from 'react';
import type { DevelopmentModeState } from '../../services/developmentModeService';

/**
 * חוזה הנתונים DevelopmentModeContextValue: מצב פיתוח / מצב פעולה / ערך.
 */
export interface DevelopmentModeContextValue extends DevelopmentModeState {
  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;
  refresh: () => Promise<void>;
  setEnabled: (enabled: boolean, durationMinutes?: number | null) => Promise<void>;
}

// DevelopmentModeContext — מצב פיתוח / מצב פעולה.
export const DevelopmentModeContext = createContext<DevelopmentModeContextValue | null>(null);

/**
 * פעולה useDevelopmentMode: חיבור מצב או הקשר עבור מצב פיתוח / מצב פעולה.
 * @returns DevelopmentModeContextValue — הפלט בהתאם לחתימה.
 */
export function useDevelopmentMode(): DevelopmentModeContextValue {
  // value — ערך.
  const value = useContext(DevelopmentModeContext);
  if (!value) throw new Error('useDevelopmentMode must be used inside DevelopmentModeProvider.');
  return value;
}
