import {
  BellRing,
  CheckCircle2,
  RefreshCw,
  Send,
} from 'lucide-react';

import {
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import {
  pushTestService,
} from '../../services/pushTestService';

import {
  useActiveUsers,
} from '../../hooks/useActiveUsers';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Textarea,
} from '../ui';

interface SendResult {
  totalDevices: number;

  sent: number;

  failed: number;
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בשליחת התראת הבדיקה.';
}

function PushTestNotification() {
const {
  users:
    activeUsers,

  isLoading:
    isLoadingUsers,

  error:
    usersError,

  reload:
    reloadUsers,
} =
  useActiveUsers();
  const [
    selectedUserId,
    setSelectedUserId,
  ] =
    useState('');

  const [
    title,
    setTitle,
  ] =
    useState(
      'בדיקת התראות GVK',
    );

  const [
    body,
    setBody,
  ] =
    useState(
      'זוהי התראת Push לבדיקה.',
    );

  const [
    url,
    setUrl,
  ] =
    useState('/');



  const [
    isSending,
    setIsSending,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    result,
    setResult,
  ] =
    useState<SendResult | null>(
      null,
    );


  const userOptions =
    useMemo(
      () =>
        activeUsers.map(
          (
            user,
          ) => ({
            value:
              user.id,

            label:
              user.scheduleName
                ? `${user.displayName} — ${user.scheduleName}`
                : user.displayName,
          }),
        ),
      [
        activeUsers,
      ],
    );
    const effectiveSelectedUserId =
  selectedUserId ||
  userOptions[0]
    ?.value ||
  '';


  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault();

      setError(
        null,
      );

      setResult(
        null,
      );

      if (
        !effectiveSelectedUserId
      ) {
        setError(
          'יש לבחור משתמש לקבלת ההתראה.',
        );

        return;
      }

      setIsSending(
        true,
      );

      try {
        const response =
          await pushTestService
            .sendTestPush({
              targetUserId:
                effectiveSelectedUserId,

              title,

              body,

              url,
            });

        setResult({
          totalDevices:
            response.totalDevices,

          sent:
            response.sent,

          failed:
            response.failed,
        });
      } catch (
        sendError
      ) {
        setError(
          getErrorMessage(
            sendError,
          ),
        );
      } finally {
        setIsSending(
          false,
        );
      }
    };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="settings-card-title-with-icon">
            <BellRing
              size={
                20
              }
              aria-hidden="true"
            />

            שליחת התראת בדיקה
          </span>
        </CardTitle>
      </CardHeader>

      <CardBody>
        <form
          className="push-test-form"
          onSubmit={
            handleSubmit
          }
        >
          <div className="push-test-form-grid">
            <Select
              label="משתמש יעד"
              value={
                effectiveSelectedUserId
              }
              placeholder={
                isLoadingUsers
                  ? 'טוען משתמשים...'
                  : 'בחר משתמש'
              }
              options={
                userOptions
              }
              disabled={
                isLoadingUsers ||
                isSending ||
                userOptions.length ===
                  0
              }
              onChange={(
                event,
              ) => {
                setSelectedUserId(
                  event.target.value,
                );
              }}
            />

            <Input
              label="כתובת פתיחה באפליקציה"
              value={
                url
              }
              placeholder="/"
              helperText="לדוגמה: / או /shifts?tab=calendar"
              disabled={
                isSending
              }
              onChange={(
                event,
              ) => {
                setUrl(
                  event.target.value,
                );
              }}
            />
          </div>

          <Input
            label="כותרת ההתראה"
            value={
              title
            }
            maxLength={
              120
            }
            disabled={
              isSending
            }
            onChange={(
              event,
            ) => {
              setTitle(
                event.target.value,
              );
            }}
          />

          <Textarea
            label="תוכן ההתראה"
            value={
              body
            }
            rows={
              4
            }
            maxLength={
              500
            }
            disabled={
              isSending
            }
            onChange={(
              event,
            ) => {
              setBody(
                event.target.value,
              );
            }}
          />

          {usersError ||
          error ? (
            <div
              className="settings-message settings-message-error"
              role="alert"
            >
              {
                usersError ??
                error
              }
            </div>
          ) : null}

          {result ? (
            <div
              className="settings-message settings-message-success"
              role="status"
            >
              <CheckCircle2
                size={
                  18
                }
                aria-hidden="true"
              />

              נשלחו בהצלחה{' '}
              {
                result.sent
              }{' '}
              מתוך{' '}
              {
                result.totalDevices
              }{' '}
              מכשירים.

              {result.failed >
              0
                ? ` נכשלו ${result.failed} משלוחים.`
                : ''}
            </div>
          ) : null}

          {userOptions.length ===
            0 &&
          !isLoadingUsers ? (
            <div className="settings-message settings-message-warning">
              לא נמצאו משתמשים פעילים שניתן לבחור.
            </div>
          ) : null}

          <div className="push-test-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={
                isLoadingUsers ||
                isSending
              }
              onClick={() => {
                void reloadUsers();
              }}
            >
              <RefreshCw
                size={
                  17
                }
                aria-hidden="true"
              />

              רענון משתמשים
            </Button>

            <Button
              type="submit"
              disabled={
                isSending ||
                isLoadingUsers ||
                !effectiveSelectedUserId ||
                !title.trim() ||
                !body.trim()
              }
            >
              <Send
                size={
                  17
                }
                aria-hidden="true"
              />

              {
                isSending
                  ? 'שולח התראה...'
                  : 'שליחת התראת בדיקה'
              }
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export default PushTestNotification;