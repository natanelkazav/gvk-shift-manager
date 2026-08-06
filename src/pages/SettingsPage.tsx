import {
  Settings,
  ShieldCheck,
} from 'lucide-react';

import {
  useAuth,
} from '../auth/AuthContext';

import PushNotificationSettings
  from '../components/settings/PushNotificationSettings';

import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
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

  const canManageScheduleImport =
    hasPermission(
      'schedule.edit',
    ) ||
    hasPermission(
      'users.manage',
    );

  const canViewAdminActions =
    canManageNotifications ||
    canManageScheduleImport;

  return (
    <section className="settings-page">
      <PageHeader
        title="הגדרות"
        description="ניהול העדפות אישיות ופעולות מערכת."
      />

      <div className="settings-page-sections">
        <section className="settings-section">
          <div className="settings-section-header">
            <Settings
              size={
                22
              }
              aria-hidden="true"
            />

            <div>
              <h2>
                ההעדפות שלי
              </h2>

              <p>
                הגדרות אישיות שחלות על החשבון והמכשירים שלך.
              </p>
            </div>
          </div>

          <PushNotificationSettings />
        </section>

        {canViewAdminActions ? (
          <section className="settings-section">
            <div className="settings-section-header">
              <ShieldCheck
                size={
                  22
                }
                aria-hidden="true"
              />

              <div>
                <h2>
                  פעולות מנהל
                </h2>

                <p>
                  כלים ניהוליים בהתאם להרשאות המשתמש.
                </p>
              </div>
            </div>

            <div className="settings-admin-grid">
              {canManageNotifications ? (
                <PushTestNotification />
              ) : null}

              {canManageScheduleImport ? (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      ייבוא קובץ שיבוצים
                    </CardTitle>
                  </CardHeader>

                  <CardBody>
                    <p className="settings-placeholder-text">
                      לכאן נעביר את מנגנון ייבוא קובץ השיבוצים הקיים מלוח הכוננים.
                    </p>
                  </CardBody>
                </Card>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}

export default SettingsPage;