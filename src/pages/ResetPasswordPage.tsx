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

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה.';
}

function ResetPasswordPage() {
  const navigate =
    useNavigate();

  const [
    isCheckingLink,
    setIsCheckingLink,
  ] =
    useState(true);

  const [
    isRecoveryReady,
    setIsRecoveryReady,
  ] =
    useState(false);

  const [
    newPassword,
    setNewPassword,
  ] =
    useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState('');

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false);

  const [
    isComplete,
    setIsComplete,
  ] =
    useState(false);

  useEffect(
    () => {
      let isMounted =
        true;

      let invalidLinkTimer:
        number | null =
          null;

      const markReady =
        (): void => {
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

      const checkSession =
        async (): Promise<void> => {
          const {
            data,
            error:
              sessionError,
          } =
            await supabase.auth
              .getSession();

          if (
            !isMounted
          ) {
            return;
          }

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

          if (
            data.session
          ) {
            markReady();

            return;
          }

          invalidLinkTimer =
            window.setTimeout(
              () => {
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

  const validateForm =
    (): string | null => {
      if (
        !newPassword
      ) {
        return 'יש להזין סיסמה חדשה.';
      }

      if (
        newPassword.length <
          8
      ) {
        return 'הסיסמה החדשה חייבת להכיל לפחות שמונה תווים.';
      }

      if (
        newPassword !==
          confirmPassword
      ) {
        return 'הסיסמאות אינן זהות.';
      }

      return null;
    };

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault();

      const validationError =
        validateForm();

      if (
        validationError
      ) {
        setError(
          validationError,
        );

        return;
      }

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

      try {
        const {
          data: {
            user,
          },
          error:
            userError,
        } =
          await supabase.auth
            .getUser();

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
              GVK Shift Manager
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
