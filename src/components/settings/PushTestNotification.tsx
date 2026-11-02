/**
 * קובץ: src/components/settings/PushTestNotification.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור התראות Push / התראות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SendResult, getErrorMessage, PushTestNotification.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * חוזה הנתונים SendResult: תוצאה.
 */
interface SendResult {
  // totalDevices — סך הכול.
  totalDevices: number;

  sent: number;

  failed: number;
}

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בשליחת התראת הבדיקה.';
}

/**
 * פעולה PushTestNotification: התראות Push / התראות.
 */
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
  // מצב מקומי: selectedUserId — מזהה משתמש; setSelectedUserId מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedUserId,
    setSelectedUserId,
  ] =
    useState('');

  // מצב מקומי: title — כותרת; setTitle מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    title,
    setTitle,
  ] =
    useState(
      'בדיקת התראות GVK',
    );

  // מצב מקומי: body — תוכן; setBody מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    body,
    setBody,
  ] =
    useState(
      'זוהי התראת Push לבדיקה.',
    );

  // מצב מקומי: url — כתובת יעד; setUrl מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    url,
    setUrl,
  ] =
    useState('/');



  // מצב מקומי: isSending — הנתון isSending בהקשר הפעולה; setIsSending מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isSending,
    setIsSending,
  ] =
    useState(false);

  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  // מצב מקומי: result — תוצאה; setResult מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    result,
    setResult,
  ] =
    useState<SendResult | null>(
      null,
    );


  // ערך מחושב userOptions — משתמש / אפשרויות בחירה; נשמר בין רינדורים עד שינוי התלויות.
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
    // effectiveSelectedUserId — מזהה משתמש.
    const effectiveSelectedUserId =
  selectedUserId ||
  userOptions[0]
    ?.value ||
  '';


  /**
   * פעולה אסינכרונית handleSubmit: טיפול באירוע עבור הנתון handleSubmit בהקשר הפעולה.
   * @param event — אירוע.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
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

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !effectiveSelectedUserId.
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

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // response — תוצאת הפעולה.
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