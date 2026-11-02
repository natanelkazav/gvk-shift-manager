/**
 * קובץ: src/features/developmentMode/DevelopmentModeBanner.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור מצב פיתוח / מצב פעולה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DevelopmentModeBanner.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { FlaskConical, X } from 'lucide-react';
import { useDevelopmentMode } from './DevelopmentModeContext';

/**
 * פעולה DevelopmentModeBanner: מצב פיתוח / מצב פעולה.
 */
export default function DevelopmentModeBanner() {
  const { enabled, expiresAt, isLoading, setEnabled } = useDevelopmentMode();
  if (!enabled) return null;

  const expiry = expiresAt ? new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit' }).format(new Date(expiresAt)) : null;

  return (
    <div className="development-mode-banner" role="status">
      <FlaskConical size={18} aria-hidden="true" />
      <strong>מצב פיתוח פעיל</strong>
      <span>כתיבות לנתוני Production והתראות מהפעולות שלך חסומות{expiry ? ` עד ${expiry}` : ''}.</span>
      <button type="button" disabled={isLoading} onClick={() => void setEnabled(false, null)}>
        <X size={16} aria-hidden="true" /> כבה מצב פיתוח
      </button>
    </div>
  );
}
