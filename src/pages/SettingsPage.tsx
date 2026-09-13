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
import DevelopmentModeSettings from '../components/settings/DevelopmentModeSettings';
import GvkLegacyMigrationPanel from '../components/settings/GvkLegacyMigrationPanel';
import DynamicCutoverSettings from '../components/settings/DynamicCutoverSettings';
import DynamicPilotQaPanel from '../components/settings/DynamicPilotQaPanel';
import LegacyCompatibilityPanel from '../components/settings/LegacyCompatibilityPanel';

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
                הגדרות ששייכות למשתמש שלך, כולל Push ותזכורות המותאמות ללוחות שאליהם יש לך גישה.
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

        {canManageUsers ? (
          <section className="settings-section settings-section-card">
            <div className="settings-section-header">
              <ShieldCheck size={22} aria-hidden="true" />
              <div><h2>Dynamic-first / Rollback</h2><p>מתג Cutover מרכזי לפיילוט. אינו מוחק נתונים וניתן לחזור זמנית ל-Legacy.</p></div>
            </div>
            <DynamicCutoverSettings />
          </section>
        ) : null}

        {canManageUsers ? (
          <section className="settings-section settings-section-card">
            <div className="settings-section-header">
              <ShieldCheck size={22} aria-hidden="true" />
              <div>
                <h2>QA לפיילוט הדינמי</h2>
                <p>בדיקות Readiness לא הרסניות לפני מעבר לבדיקת המערכת הידנית המלאה.</p>
              </div>
            </div>
            <DynamicPilotQaPanel />
          </section>
        ) : null}

        {canManageUsers ? (
          <section className="settings-section settings-section-card">
            <div className="settings-section-header">
              <ShieldCheck size={22} aria-hidden="true" />
              <div>
                <h2>מעבר GVK למערכת הדינמית</h2>
                <p>Adapter חד-פעמי שממפה את שלושת מקורות ה-Legacy של הפיילוט לתפקידי Job Type שתבחר.</p>
              </div>
            </div>
            <GvkLegacyMigrationPanel />
          </section>
        ) : null}

        {canManageUsers ? (
          <section className="settings-section settings-section-card">
            <div className="settings-section-header">
              <ShieldCheck size={22} aria-hidden="true" />
              <div>
                <h2>כלי Legacy לשחזור</h2>
                <p>מסכי המערכת הישנה הוצאו מהניווט הראשי ונשמרו כאן לצורכי Rollback ובדיקות בלבד.</p>
              </div>
            </div>
            <LegacyCompatibilityPanel />
          </section>
        ) : null}

        {isSystemAdmin ? (
          <section className="settings-section settings-section-card settings-development-section">
            <div className="settings-section-header">
              <ShieldCheck size={22} aria-hidden="true" />
              <div><h2>סביבת פיתוח בטוחה</h2><p>הפעל סימולציה אישית לפני בדיקות בזמן שהמערכת בשימוש.</p></div>
            </div>
            <DevelopmentModeSettings />
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
