import { ChevronDown, MonitorSmartphone, RefreshCw, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { APP_BUILD_ID, APP_VERSION, getAppBuildLabel } from '../../config/appBuild';
import { notificationService } from '../../features/notifications/services/notificationService';
import { NotificationPriority, NotificationType } from '../../features/notifications/types/notificationTypes';
import { clientVersionService, type ClientVersionOverview, type ClientVersionUserRow } from '../../services/clientVersionService';
import { Button } from '../ui';

interface ClientVersionAdminPanelProps {
  canSendUpdateNotifications: boolean;
}

type TargetMode = 'outdated' | 'all' | `job:${string}`;

function formatSeenAt(value: string | null): string {
  if (!value) return 'לא דווח';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'לא ידוע';
  return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function statusLabel(row: ClientVersionUserRow): string {
  switch (row.status) {
    case 'current': return 'מעודכן';
    case 'mixed': return 'חלק מהמכשירים ישנים';
    case 'outdated': return 'דורש עדכון';
    default: return 'לא דווחה גרסה';
  }
}

export default function ClientVersionAdminPanel({ canSendUpdateNotifications }: ClientVersionAdminPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [overview, setOverview] = useState<ClientVersionOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<TargetMode>('outdated');

  const loadOverview = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      setOverview(await clientVersionService.getAdminOverview());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'לא ניתן היה לטעון את נתוני הגרסאות.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !overview && !isLoading) void loadOverview();
  }, [isOpen, overview, isLoading]);

  const jobTypes = useMemo(() => {
    const map = new Map<string, string>();
    overview?.users.forEach((user) => user.jobTypes.forEach((jobType) => map.set(jobType.id, jobType.name)));
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [overview]);

  const targetUsers = useMemo(() => {
    const users = overview?.users.filter((user) => user.isActive) ?? [];
    if (targetMode === 'all') return users;
    if (targetMode === 'outdated') return users.filter((user) => user.status === 'outdated' || user.status === 'mixed');
    if (targetMode.startsWith('job:')) {
      const jobTypeId = targetMode.slice(4);
      return users.filter((user) => user.jobTypes.some((jobType) => jobType.id === jobTypeId));
    }
    return [];
  }, [overview, targetMode]);

  const sendUpdateRequest = async (): Promise<void> => {
    if (!canSendUpdateNotifications || targetUsers.length === 0 || isSending) return;
    const confirmed = window.confirm(`לשלוח בקשת עדכון מערכת ל-${targetUsers.length} משתמשים?`);
    if (!confirmed) return;

    setIsSending(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await notificationService.createNotification({
        userIds: targetUsers.map((user) => user.userId),
        type: NotificationType.SYSTEM,
        priority: NotificationPriority.IMPORTANT,
        title: 'עדכון מערכת זמין',
        body: `זמינה גרסה חדשה של מערכת המשמרות (${APP_VERSION}). יש לפתוח את המערכת ולאשר את העדכון כאשר תופיע בקשת העדכון.`,
        url: '/notifications',
        source: 'app_version_update',
        data: {
          action: 'app_update',
          targetVersion: APP_VERSION,
          targetBuildId: APP_BUILD_ID,
        },
      });
      setSuccess(`ההתראה נשלחה ל-${result.totalRecipients} משתמשים. Push נמסר ל-${result.recipientsDelivered} נמענים.`);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'שליחת בקשת העדכון נכשלה.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="client-version-panel">
      <button type="button" className="client-version-panel-toggle" onClick={() => setIsOpen((value) => !value)} aria-expanded={isOpen}>
        <span><MonitorSmartphone size={19} /> גרסאות מערכת ועדכוני משתמשים</span>
        <span className="client-version-panel-current">הגרסה הנוכחית: {getAppBuildLabel()}</span>
        <ChevronDown size={18} className={isOpen ? 'is-open' : ''} />
      </button>

      {isOpen ? (
        <div className="client-version-panel-body">
          <div className="client-version-toolbar">
            <div className="client-version-summary">
              <span>מעודכנים <strong>{overview?.summary.current ?? '—'}</strong></span>
              <span>מעורב <strong>{overview?.summary.mixed ?? '—'}</strong></span>
              <span>דורשים עדכון <strong>{overview?.summary.outdated ?? '—'}</strong></span>
              <span>לא ידוע <strong>{overview?.summary.unknown ?? '—'}</strong></span>
            </div>
            <Button type="button" variant="secondary" onClick={() => void loadOverview()} disabled={isLoading}>
              <RefreshCw size={17} className={isLoading ? 'users-loading-icon' : ''} /> רענון גרסאות
            </Button>
          </div>

          {canSendUpdateNotifications ? (
            <div className="client-version-send-row">
              <label>
                <span>קבוצת יעד</span>
                <select value={targetMode} onChange={(event) => setTargetMode(event.target.value as TargetMode)}>
                  <option value="outdated">רק משתמשים עם גרסה ישנה</option>
                  <option value="all">כל המשתמשים הפעילים</option>
                  {jobTypes.map((jobType) => <option key={jobType.id} value={`job:${jobType.id}`}>תפקיד: {jobType.name}</option>)}
                </select>
              </label>
              <Button type="button" onClick={() => void sendUpdateRequest()} disabled={isSending || targetUsers.length === 0}>
                <Send size={17} /> {isSending ? 'שולח...' : `שלח בקשת עדכון (${targetUsers.length})`}
              </Button>
            </div>
          ) : null}

          {error ? <div className="users-error" role="alert">{error}</div> : null}
          {success ? <div className="users-success" role="status">{success}</div> : null}

          <div className="client-version-table-wrap">
            <table className="client-version-table">
              <thead><tr><th>משתמש</th><th>תפקידים</th><th>גרסה אחרונה</th><th>Build</th><th>מכשירים</th><th>נראה לאחרונה</th><th>מצב</th></tr></thead>
              <tbody>
                {(overview?.users ?? []).map((row) => (
                  <tr key={row.userId}>
                    <td><strong>{row.displayName}</strong><small>{row.email}</small></td>
                    <td>{row.jobTypes.map((jobType) => jobType.name).join(', ') || '—'}</td>
                    <td>{row.latestVersion ?? '—'}</td>
                    <td><code>{row.latestBuildId ?? '—'}</code></td>
                    <td>{row.deviceCount}{row.outdatedDeviceCount > 0 ? ` (${row.outdatedDeviceCount} ישנים)` : ''}</td>
                    <td>{formatSeenAt(row.latestSeenAt)}</td>
                    <td><span className={`client-version-status is-${row.status}`}>{statusLabel(row)}</span></td>
                  </tr>
                ))}
                {!isLoading && (overview?.users.length ?? 0) === 0 ? <tr><td colSpan={7}>אין נתוני משתמשים להצגה.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
