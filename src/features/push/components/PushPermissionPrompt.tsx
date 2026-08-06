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

const SESSION_STORAGE_KEY =
  'push-permission-dismissed';

function PushPermissionPrompt() {
  const {
    state,
    shouldPrompt,
    shouldShowBlockedMessage,
    enablePush,
    clearError,
  } =
    usePushStatusContext();

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

  const handleEnablePush =
    async (): Promise<void> => {
      const success =
        await enablePush();

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