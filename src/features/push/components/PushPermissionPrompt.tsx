/**
 * קובץ: src/features/push/components/PushPermissionPrompt.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור התראות Push / הרשאות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PushPermissionPrompt.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  Bell,
  BellOff,
} from 'lucide-react';

import {
  useState,
} from 'react';

import {
  Button,
  Card,
  CardBody,
} from '../../../components/ui';

import {
  usePushStatusContext,
} from '../context/usePushStatusContext';

// SESSION_STORAGE_KEY — סשן / מפתח.
const SESSION_STORAGE_KEY =
  'push-permission-dismissed';

/**
 * פעולה PushPermissionPrompt: התראות Push / הרשאות.
 */
function PushPermissionPrompt() {
  const {
    state,
    shouldPrompt,
    shouldShowBlockedMessage,
    enablePush,
    clearError,
  } =
    usePushStatusContext();

  // מצב מקומי: isDismissed — הנתון isDismissed בהקשר הפעולה; setIsDismissed מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isDismissed,
    setIsDismissed,
  ] =
    useState(
      () =>
        sessionStorage.getItem(
          SESSION_STORAGE_KEY,
        ) ===
        'true',
    );

  /**
   * פעולה אסינכרונית handleEnablePush: טיפול באירוע עבור התראות Push.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleEnablePush =
    async (): Promise<void> => {
      const success =
        await enablePush();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !success.
      if (
        !success
      ) {
        return;
      }

      sessionStorage.removeItem(
        SESSION_STORAGE_KEY,
      );

      setIsDismissed(
        true,
      );
    };

  /**
   * פעולה handleDismiss: טיפול באירוע עבור הנתון handleDismiss בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleDismiss =
    (): void => {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        'true',
      );

      clearError();

      setIsDismissed(
        true,
      );
    };

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isDismissed || state.isLoading || ( !shouldPrompt && !shouldShowBlockedMessage ).
  if (
    isDismissed ||
    state.isLoading ||
    (
      !shouldPrompt &&
      !shouldShowBlockedMessage
    )
  ) {
    return null;
  }

  return (
    <Card className="push-permission-banner">
      <CardBody>
        <div className="push-permission-header">
          <div className="push-permission-icon">
            {shouldPrompt ? (
              <Bell
                size={
                  22
                }
                aria-hidden="true"
              />
            ) : (
              <BellOff
                size={
                  22
                }
                aria-hidden="true"
              />
            )}
          </div>

          <div className="push-permission-content">
            <h3>
              {
                shouldPrompt
                  ? 'הפעלת התראות'
                  : 'ההתראות חסומות'
              }
            </h3>

            <p>
              {
                shouldPrompt
                  ? 'קבל תזכורות לפני תחילת המשמרת, עדכוני שיבוץ והתראות חשובות.'
                  : 'כדי לקבל תזכורות, יש לאפשר התראות דרך הגדרות האתר או הדפדפן.'
              }
            </p>
          </div>
        </div>

        {state.error ? (
          <div
            className="settings-message settings-message-error"
            role="alert"
          >
            {
              state.error
            }
          </div>
        ) : null}

        <div className="push-permission-actions">
          {shouldPrompt ? (
            <Button
              type="button"
              disabled={
                state.isEnabling
              }
              onClick={() => {
                void handleEnablePush();
              }}
            >
              <Bell
                size={
                  17
                }
                aria-hidden="true"
              />

              {
                state.isEnabling
                  ? 'מפעיל התראות...'
                  : 'הפעלת התראות'
              }
            </Button>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            disabled={
              state.isEnabling
            }
            onClick={
              handleDismiss
            }
          >
            {
              shouldPrompt
                ? 'הזכר לי מאוחר יותר'
                : 'הבנתי'
            }
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default PushPermissionPrompt;