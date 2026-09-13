import { FlaskConical, X } from 'lucide-react';
import { useDevelopmentMode } from './DevelopmentModeContext';

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
