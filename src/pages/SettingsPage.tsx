import {
  BellRing,
  LayoutDashboard,
  FileSpreadsheet,
  Settings,
  ShieldCheck,
  Wrench,
  Palette,
} from 'lucide-react';

import {
  useEffect,
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
import DevelopmentModeSettings from '../components/settings/DevelopmentModeSettings';
import GvkLegacyMigrationPanel from '../components/settings/GvkLegacyMigrationPanel';
import DynamicCutoverSettings from '../components/settings/DynamicCutoverSettings';
import DynamicPilotQaPanel from '../components/settings/DynamicPilotQaPanel';
import LegacyCompatibilityPanel from '../components/settings/LegacyCompatibilityPanel';
import DashboardWidgetSettings from '../components/settings/DashboardWidgetSettings';
import { dashboardWidgetService } from '../services/dashboardWidgetService';
import ThemeSettings from '../components/settings/ThemeSettings';

type FileToolTab =
  | 'import'
  | 'export';

function SettingsPage() {
  const {
    hasPermission,
    profile,
  } = useAuth();

  const isSystemAdmin = profile?.role === 'admin';
  const canManageUsers = hasPermission('users.manage');

  const canManageNotifications =
    hasPermission(
      'notifications.manage',
    );

  const canUseShiftReminders =
    hasPermission(
      'schedule.view',
    ) ||
    hasPermission(
      'morning_driver_schedule.view',
    );

  const canUseDriverDutyReminders =
    hasPermission(
      'driver_schedule.view',
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

  const canUseAdvancedSystemTools =
    canManageUsers ||
    canManageNotifications ||
    isSystemAdmin;

  const [canConfigureDashboard, setCanConfigureDashboard] = useState(false);

  useEffect(() => {
    let active = true;
    void dashboardWidgetService.canConfigure()
      .then((allowed) => { if (active) setCanConfigureDashboard(allowed); });
    return () => { active = false; };
  }, []);

  return (
    <section className="settings-page">
      <PageHeader
        title="הגדרות"
        description="העדפות אישיות, קבצים וכלי ניהול מערכת. כלי מעבר ו-Legacy נשמרים באזור מתקדם כדי לא להעמיס על העבודה השוטפת."
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
                Push ותזכורות אישיות לפי הלוחות שאליהם יש לך גישה.
              </p>
            </div>
          </div>

          <PushNotificationSettings
            showShiftReminderPreferences={
              canUseShiftReminders
            }
            showDriverDutyReminderPreferences={
              canUseDriverDutyReminders
            }
          />

          <div className="settings-personal-divider" />

          <div className="settings-subsection-heading">
            <Palette size={20} aria-hidden="true" />
            <div>
              <h3>ערכת נושא</h3>
              <p>בחר את צבעי המערכת במכשיר הזה. השינוי יחול לאחר לחיצה על אישור.</p>
            </div>
          </div>

          <ThemeSettings />
        </section>

        {canConfigureDashboard ? (
          <section className="settings-section settings-section-card">
            <div className="settings-section-header">
              <LayoutDashboard size={22} aria-hidden="true" />
              <div>
                <h2>לוח הבקרה</h2>
                <p>התאם את המידע התפעולי שמופיע בלוח הבקרה האישי שלך.</p>
              </div>
            </div>
            <DashboardWidgetSettings />
          </section>
        ) : null}

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
                        טעינת לוחות Excel קיימים למערכת.
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

        {canUseAdvancedSystemTools ? (
          <section className="settings-section settings-section-card settings-advanced-card">
            <div className="settings-section-header">
              <ShieldCheck size={22} aria-hidden="true" />
              <div>
                <h2>ניהול מערכת</h2>
                <p>
                  כלי תחזוקה, בדיקות ו-Recovery. אין צורך להשתמש בהם בעבודה השוטפת.
                </p>
              </div>
            </div>

            <details className="settings-tool-group">
              <summary>
                <span className="settings-tool-summary-icon" aria-hidden="true">
                  <Wrench size={18} />
                </span>
                <span>
                  <strong>כלים מתקדמים ו-Recovery</strong>
                  <small>Dynamic-first, QA, Legacy, סביבת פיתוח ובדיקות Push</small>
                </span>
              </summary>

              <div className="settings-tool-group-content">
                {canManageUsers ? (
                  <details className="settings-advanced-item">
                    <summary>מצב Dynamic-first ו-Rollback</summary>
                    <div className="settings-advanced-item-content">
                      <DynamicCutoverSettings />
                    </div>
                  </details>
                ) : null}

                {canManageUsers ? (
                  <details className="settings-advanced-item">
                    <summary>בדיקות QA לפיילוט הדינמי</summary>
                    <div className="settings-advanced-item-content">
                      <DynamicPilotQaPanel />
                    </div>
                  </details>
                ) : null}

                {canManageUsers ? (
                  <details className="settings-advanced-item">
                    <summary>העברת נתוני GVK מ-Legacy</summary>
                    <div className="settings-advanced-item-content">
                      <GvkLegacyMigrationPanel />
                    </div>
                  </details>
                ) : null}

                {canManageUsers ? (
                  <details className="settings-advanced-item">
                    <summary>כלי Legacy לשחזור</summary>
                    <div className="settings-advanced-item-content">
                      <LegacyCompatibilityPanel />
                    </div>
                  </details>
                ) : null}

                {isSystemAdmin ? (
                  <details className="settings-advanced-item">
                    <summary>סביבת פיתוח בטוחה</summary>
                    <div className="settings-advanced-item-content">
                      <DevelopmentModeSettings />
                    </div>
                  </details>
                ) : null}

                {canManageNotifications ? (
                  <details className="settings-advanced-item">
                    <summary>
                      <span className="settings-inline-summary-icon" aria-hidden="true">
                        <BellRing size={16} />
                      </span>
                      בדיקת Push והתראות
                    </summary>
                    <div className="settings-advanced-item-content">
                      <PushTestNotification />
                    </div>
                  </details>
                ) : null}
              </div>
            </details>
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
