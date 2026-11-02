/**
 * קובץ: src/pages/ResetPasswordPage.tsx
 * מטרה: מימוש מסך המשתמש עבור סיסמה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: getErrorMessage, ResetPasswordPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  KeyRound,
  ShieldCheck,
} from 'lucide-react';

import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  Button,
  Input,
} from '../components/ui';

import {
  supabase,
} from '../lib/supabase';

import {
  authService,
} from '../services/authService';

import '../styles/auth.css';

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

  return 'אירעה שגיאה בלתי צפויה.';
}

/**
 * פעולה ResetPasswordPage: איפוס סיסמה.
 */
function ResetPasswordPage() {
  const navigate =
    useNavigate();

  // מצב מקומי: isCheckingLink — הנתון isCheckingLink בהקשר הפעולה; setIsCheckingLink מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isCheckingLink,
    setIsCheckingLink,
  ] =
    useState(true);

  // מצב מקומי: isRecoveryReady — הנתון isRecoveryReady בהקשר הפעולה; setIsRecoveryReady מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isRecoveryReady,
    setIsRecoveryReady,
  ] =
    useState(false);

  // מצב מקומי: newPassword — סיסמה; setNewPassword מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    newPassword,
    setNewPassword,
  ] =
    useState('');

  // מצב מקומי: confirmPassword — סיסמה; setConfirmPassword מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState('');

  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  // מצב מקומי: isSaving — האם שמירה מתבצעת; setIsSaving מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false);

  // מצב מקומי: isComplete — הנתון isComplete בהקשר הפעולה; setIsComplete מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isComplete,
    setIsComplete,
  ] =
    useState(false);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(
    () => {
      // isMounted — הנתון isMounted בהקשר הפעולה.
      let isMounted =
        true;

      let invalidLinkTimer:
        number | null =
          null;

      /**
       * פעולה markReady: הנתון markReady בהקשר הפעולה.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const markReady =
        (): void => {
          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isMounted.
          if (
            !isMounted
          ) {
            return;
          }

          if (
            invalidLinkTimer !==
              null
          ) {
            window.clearTimeout(
              invalidLinkTimer,
            );

            invalidLinkTimer =
              null;
          }

          setIsRecoveryReady(
            true,
          );

          setIsCheckingLink(
            false,
          );

          setError(
            null,
          );
        };

      /**
       * פעולה אסינכרונית checkSession: בדיקת סשן.
       * @returns Promise<void> — הפלט בהתאם לחתימה.
       */
      const checkSession =
        async (): Promise<void> => {
          // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
          const {
            data,
            error:
              sessionError,
          } =
            await supabase.auth
              .getSession();

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isMounted.
          if (
            !isMounted
          ) {
            return;
          }

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר sessionError.
          if (
            sessionError
          ) {
            setError(
              'לא ניתן היה לאמת את קישור איפוס הסיסמה.',
            );

            setIsCheckingLink(
              false,
            );

            return;
          }

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר data.session.
          if (
            data.session
          ) {
            markReady();

            return;
          }

          invalidLinkTimer =
            window.setTimeout(
              () => {
                // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isMounted.
                if (
                  !isMounted
                ) {
                  return;
                }

                setIsCheckingLink(
                  false,
                );

                setError(
                  'קישור איפוס הסיסמה אינו תקף או שפג תוקפו. בקש קישור חדש ממנהל המערכת.',
                );
              },
              1500,
            );
        };

      const {
        data: {
          subscription,
        },
      } =
        supabase.auth
          .onAuthStateChange(
            (
              event,
              session,
            ) => {
              // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isMounted || !session.
              if (
                !isMounted ||
                !session
              ) {
                return;
              }

              if (
                event ===
                  'PASSWORD_RECOVERY' ||
                event ===
                  'SIGNED_IN' ||
                event ===
                  'INITIAL_SESSION'
              ) {
                markReady();
              }
            },
          );

      void checkSession();

      return () => {
        isMounted =
          false;

        if (
          invalidLinkTimer !==
            null
        ) {
          window.clearTimeout(
            invalidLinkTimer,
          );
        }

        subscription.unsubscribe();
      };
    },
    [],
  );

  /**
   * פעולה validateForm: בדיקת תקינות של הנתון validateForm בהקשר הפעולה.
   * @returns string | null — הפלט בהתאם לחתימה.
   */
  const validateForm =
    (): string | null => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !newPassword.
      if (
        !newPassword
      ) {
        return 'יש להזין סיסמה חדשה.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר newPassword.length < 8.
      if (
        newPassword.length <
          8
      ) {
        return 'הסיסמה החדשה חייבת להכיל לפחות שמונה תווים.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר newPassword !== confirmPassword.
      if (
        newPassword !==
          confirmPassword
      ) {
        return 'הסיסמאות אינן זהות.';
      }

      return null;
    };

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

      // validationError — אימות נתונים / שגיאה.
      const validationError =
        validateForm();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר validationError.
      if (
        validationError
      ) {
        setError(
          validationError,
        );

        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isRecoveryReady.
      if (
        !isRecoveryReady
      ) {
        setError(
          'קישור איפוס הסיסמה עדיין לא אומת.',
        );

        return;
      }

      setIsSaving(
        true,
      );

      setError(
        null,
      );

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const {
          data: {
            user,
          },
          error:
            userError,
        } =
          await supabase.auth
            .getUser();

        // עצירת הפעולה עם שגיאה כאשר userError || !user.
        if (
          userError ||
          !user
        ) {
          throw new Error(
            'קישור איפוס הסיסמה אינו תקף או שפג תוקפו.',
          );
        }

        await authService
          .changePassword(
            user.id,
            newPassword,
          );

        await authService
          .signOut();

        setIsComplete(
          true,
        );

        setIsRecoveryReady(
          false,
        );
      } catch (
        passwordError
      ) {
        setError(
          getErrorMessage(
            passwordError,
          ),
        );
      } finally {
        setIsSaving(
          false,
        );
      }
    };

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <ShieldCheck
              size={30}
              aria-hidden="true"
            />
          </div>

          <div>
            <h1>
              צוות GVK
            </h1>

            <p>
              איפוס סיסמה מאובטח
            </p>
          </div>
        </div>

        <section className="auth-card">
          <header className="auth-card-header">
            <h2>
              בחירת סיסמה חדשה
            </h2>

            <p>
              הגדר סיסמה חדשה לחשבון שלך. הקישור מיועד לשימוש חד־פעמי.
            </p>
          </header>

          {error ? (
            <div
              className="auth-error"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {isComplete ? (
            <div className="auth-form">
              <div
                className="users-success"
                role="status"
              >
                הסיסמה עודכנה בהצלחה. ניתן להתחבר כעת עם הסיסמה החדשה.
              </div>

              <Button
                type="button"
                className="auth-submit-button"
                onClick={() => {
                  navigate(
                    '/login',
                    {
                      replace:
                        true,
                    },
                  );
                }}
              >
                מעבר להתחברות
              </Button>
            </div>
          ) : isCheckingLink ? (
            <div className="auth-form">
              <p>
                מאמת את קישור איפוס הסיסמה...
              </p>
            </div>
          ) : (
            <form
              className="auth-form"
              onSubmit={(
                event,
              ) => {
                void handleSubmit(
                  event,
                );
              }}
            >
              <Input
                id="recovery-new-password"
                label="סיסמה חדשה"
                type="password"
                value={
                  newPassword
                }
                placeholder="לפחות שמונה תווים"
                autoComplete="new-password"
                startIcon={
                  <KeyRound
                    size={18}
                    aria-hidden="true"
                  />
                }
                disabled={
                  isSaving ||
                  !isRecoveryReady
                }
                onChange={(
                  event,
                ) => {
                  setNewPassword(
                    event.target
                      .value,
                  );

                  setError(
                    null,
                  );
                }}
              />

              <Input
                id="recovery-confirm-password"
                label="אימות סיסמה חדשה"
                type="password"
                value={
                  confirmPassword
                }
                placeholder="הזן את הסיסמה שוב"
                autoComplete="new-password"
                startIcon={
                  <KeyRound
                    size={18}
                    aria-hidden="true"
                  />
                }
                disabled={
                  isSaving ||
                  !isRecoveryReady
                }
                onChange={(
                  event,
                ) => {
                  setConfirmPassword(
                    event.target
                      .value,
                  );

                  setError(
                    null,
                  );
                }}
              />

              <Button
                type="submit"
                className="auth-submit-button"
                disabled={
                  isSaving ||
                  !isRecoveryReady
                }
              >
                {isSaving
                  ? 'מעדכן סיסמה...'
                  : 'עדכון סיסמה'}
              </Button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export default ResetPasswordPage;
