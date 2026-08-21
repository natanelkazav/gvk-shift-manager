import {
  BellRing,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
} from 'lucide-react';

import {
  useState,
} from 'react';

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

type FileToolTab =
  | 'import'
  | 'export';

function SettingsPage() {
  const {
    hasPermission,
  } = useAuth();

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

  const defaultFileTab:
    FileToolTab =
      canImportSchedules
        ? 'import'
        : 'export';

  const [
    fileToolTab,
    setFileToolTab,
  ] = useState<FileToolTab>(
    defaultFileTab,
  );

  const canUseFileTools =
    canImportSchedules ||
    canExportSchedules;

  return (
    <section className="settings-page">
      <PageHeader
        title="הגדרות"
        description="העדפות אישיות וכלי מערכת מסודרים לפי תחום ובהתאם להרשאות שלך."
      />

      <div className="settings-page-sections">
        <section className="settings-section settings-section-card">
          <div className="settings-section-header">
            <Settings
              size={22}
              aria-hidden="true"
            />

            <div>
              <h2>העדפות אישיות</h2>

              <p>
                הגדרות ששייכות למשתמש שלך, כולל Push וזמן התראה לפני משמרת.
              </p>
            </div>
          </div>

          <PushNotificationSettings />
        </section>

        {canUseFileTools ? (
          <section className="settings-section settings-section-card">
            <div className="settings-section-header">
              <FileSpreadsheet
                size={22}
                aria-hidden="true"
              />

              <div>
                <h2>קבצים ונתונים</h2>

                <p>
                  ייבוא וייצוא לוחות Excel במקום אחד. יוצגו רק הפעולות שמותר לך לבצע.
                </p>
              </div>
            </div>

            {canImportSchedules &&
            canExportSchedules ? (
              <div
                className="settings-file-tabs"
                role="tablist"
                aria-label="כלי קבצים"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={
                    fileToolTab ===
                    'import'
                  }
                  className={
                    fileToolTab ===
                    'import'
                      ? 'settings-file-tab settings-file-tab-active'
                      : 'settings-file-tab'
                  }
                  onClick={() => {
                    setFileToolTab(
                      'import',
                    );
                  }}
                >
                  ייבוא
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={
                    fileToolTab ===
                    'export'
                  }
                  className={
                    fileToolTab ===
                    'export'
                      ? 'settings-file-tab settings-file-tab-active'
                      : 'settings-file-tab'
                  }
                  onClick={() => {
                    setFileToolTab(
                      'export',
                    );
                  }}
                >
                  ייצוא
                </button>
              </div>
            ) : null}

            <div className="settings-file-tool-content">
              {canImportSchedules &&
              (
                fileToolTab ===
                  'import' ||
                !canExportSchedules
              ) ? (
                <section className="settings-import-section">
                  <div className="settings-subsection-heading">
                    <FileSpreadsheet
                      size={20}
                      aria-hidden="true"
                    />

                    <div>
                      <h3>ייבוא קובץ שיבוצים</h3>
                      <p>
                        טעינת לוחות מוקדנים, כוננים וכונני בוקר מקובץ Excel קיים.
                      </p>
                    </div>
                  </div>

                  <ScheduleImportPanel />
                </section>
              ) : null}

              {canExportSchedules &&
              (
                fileToolTab ===
                  'export' ||
                !canImportSchedules
              ) ? (
                <section className="settings-export-section">
                  <ScheduleExportPanel />
                </section>
              ) : null}
            </div>
          </section>
        ) : null}

        {canManageNotifications ? (
          <section className="settings-section settings-section-card">
            <div className="settings-section-header">
              <BellRing
                size={22}
                aria-hidden="true"
              />

              <div>
                <h2>התראות וכלי בדיקה</h2>

                <p>
                  כלי בדיקה ניהוליים למערכת ההתראות וה-Push.
                </p>
              </div>
            </div>

            <PushTestNotification />
          </section>
        ) : null}

        {(canUseFileTools ||
          canManageNotifications) ? (
          <div className="settings-permission-note">
            <ShieldCheck
              size={17}
              aria-hidden="true"
            />

            <span>
              כלים ניהוליים מוצגים לפי ההרשאות שהוקצו למשתמש שלך.
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default SettingsPage;
