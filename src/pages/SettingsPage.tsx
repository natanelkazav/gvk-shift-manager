import {
  FileSpreadsheet,
  Settings,
  ShieldCheck,
} from 'lucide-react';

import {
  useAuth,
} from '../auth/AuthContext';

import ScheduleImportPanel
  from '../components/scheduleImport/ScheduleImportPanel';

import ScheduleExportPanel
  from '../components/settings/ScheduleExportPanel';

import PushNotificationSettings
  from '../components/settings/PushNotificationSettings';

import {
  PageHeader,
} from '../components/ui';

import PushTestNotification
  from '../components/settings/PushTestNotification';

import '../styles/settings.css';

function SettingsPage() {
  const {
    hasPermission,
  } =
    useAuth();

  const canManageNotifications =
    hasPermission(
      'notifications.manage',
    );

  const canImportSchedules =
    hasPermission(
      'schedule_import.manage',
    );

  const canExportSchedules =
    hasPermission(
      'schedule_export.manage',
    );

  const canViewAdminActions =
    canManageNotifications ||
    canImportSchedules ||
    canExportSchedules;

  return (
    <section className="settings-page">
      <PageHeader
        title="הגדרות"
        description="העדפות אישיות וכלי מערכת בהתאם להרשאות שלך."
      />

      <div className="settings-page-sections">
        <section className="settings-section">
          <div className="settings-section-header">
            <Settings
              size={22}
              aria-hidden="true"
            />

            <div>
              <h2>ההעדפות שלי</h2>

              <p>
                הגדרות אישיות הזמינות לכל משתמש, כולל Push וזמן התראה לפני משמרת.
              </p>
            </div>
          </div>

          <PushNotificationSettings />
        </section>

        {canViewAdminActions ? (
          <section className="settings-section">
            <div className="settings-section-header">
              <ShieldCheck
                size={22}
                aria-hidden="true"
              />

              <div>
                <h2>כלים ניהוליים</h2>

                <p>
                  כלים שמופיעים רק כאשר קיימת למשתמש ההרשאה המתאימה.
                </p>
              </div>
            </div>

            <div className="settings-admin-stack">
              {canManageNotifications ? (
                <PushTestNotification />
              ) : null}

              {canImportSchedules ? (
                <section className="settings-import-section">
                  <div className="settings-subsection-heading">
                    <FileSpreadsheet
                      size={20}
                      aria-hidden="true"
                    />

                    <div>
                      <h3>ייבוא קובץ שיבוצים</h3>
                      <p>
                        ייבוא לוחות מוקדנים, כוננים וכונני בוקר מקובצי Excel.
                      </p>
                    </div>
                  </div>

                  <ScheduleImportPanel />
                </section>
              ) : null}

              {canExportSchedules ? (
                <section className="settings-export-section">
                  <ScheduleExportPanel />
                </section>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

export default SettingsPage;
