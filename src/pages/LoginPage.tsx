/**
 * קובץ: src/pages/LoginPage.tsx
 * מטרה: הצגת טופס התחברות וטיפול בפרטי משתמש, זכירת התחברות ושגיאות אימות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: LoginPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  LockKeyhole,
  LogIn,
  Mail,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import {
  useNavigate,
} from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  authService,
} from '../services/authService';
import {
  Button,
  Input,
} from '../components/ui';
import '../styles/auth.css';



/**
 * פעולה LoginPage: הנתון LoginPage בהקשר הפעולה.
 */
function LoginPage() {
  const navigate = useNavigate();

  const {
    signIn,
    error,
    clearError,
  } = useAuth();

  // מצב מקומי: email — כתובת דוא״ל; setEmail מעדכנת אותו ומפעילה רינדור לפי React.
  const [email, setEmail] =
    useState('');

  // מצב מקומי: password — סיסמה; setPassword מעדכנת אותו ומפעילה רינדור לפי React.
  const [password, setPassword] =
    useState('');

  // מצב מקומי: rememberMe — הנתון rememberMe בהקשר הפעולה; setRememberMe מעדכנת אותו ומפעילה רינדור לפי React.
  const [rememberMe, setRememberMe] =
    useState(false);

  // מצב מקומי: isSubmitting — האם הגשה מתבצעת; setIsSubmitting מעדכנת אותו ומפעילה רינדור לפי React.
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  // מצב מקומי: formError — שגיאה; setFormError מעדכנת אותו ומפעילה רינדור לפי React.
  const [formError, setFormError] =
    useState<string | null>(null);

  // מצב מקומי: isSendingPasswordReset — סיסמה; setIsSendingPasswordReset מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isSendingPasswordReset,
    setIsSendingPasswordReset,
  ] =
    useState(false);

  // מצב מקומי: passwordResetMessage — סיסמה / הודעה; setPasswordResetMessage מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    passwordResetMessage,
    setPasswordResetMessage,
  ] =
    useState<string | null>(null);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [clearError].
  useEffect(() => {
    clearError();

    return () => {
      clearError();
    };
  }, [clearError]);

  /**
   * פעולה validateForm: בדיקת תקינות של הנתון validateForm בהקשר הפעולה.
   * @returns string | null — הפלט בהתאם לחתימה.
   */
  const validateForm =
    (): string | null => {
      // normalizedEmail — כתובת דוא״ל.
      const normalizedEmail =
        email.trim();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedEmail.
      if (!normalizedEmail) {
        return 'יש להזין כתובת אימייל.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedEmail.includes('@').
      if (!normalizedEmail.includes('@')) {
        return 'יש להזין כתובת אימייל תקינה.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !password.
      if (!password) {
        return 'יש להזין סיסמה.';
      }

      return null;
    };

  /**
   * פעולה אסינכרונית handleSubmit: טיפול באירוע עבור הנתון handleSubmit בהקשר הפעולה.
   * @param event — אירוע.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    // validationError — אימות נתונים / שגיאה.
    const validationError =
      validateForm();

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר validationError.
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    clearError();

    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await signIn({
        email: email.trim(),
        password,
        rememberMe,
      });

    navigate(
      '/',
      {
        replace: true,
        state: null,
      },
    );
    } catch (signInError) {
      if (signInError instanceof Error) {
        setFormError(
          signInError.message,
        );
      } else {
        setFormError(
          'ההתחברות נכשלה מסיבה בלתי צפויה.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * פעולה אסינכרונית handleForgotPassword: טיפול באירוע עבור סיסמה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleForgotPassword =
    async (): Promise<void> => {
      // normalizedEmail — כתובת דוא״ל.
      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      setPasswordResetMessage(
        null,
      );
      setFormError(
        null,
      );
      clearError();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedEmail || !normalizedEmail.includes( '@', ).
      if (
        !normalizedEmail ||
        !normalizedEmail.includes(
          '@',
        )
      ) {
        setFormError(
          'הזן קודם כתובת אימייל תקינה בשדה האימייל.',
        );

        return;
      }

      setIsSendingPasswordReset(
        true,
      );

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await authService
          .requestPasswordReset(
            normalizedEmail,
          );

        /*
         * הודעה כללית בכוונה:
         * לא חושפים האם האימייל קיים במערכת.
         */
        setPasswordResetMessage(
          'אם קיימת כתובת משתמש תואמת, נשלח אליה קישור לאיפוס הסיסמה.',
        );
      } catch (
        resetError
      ) {
        setFormError(
          resetError instanceof
            Error
            ? resetError.message
            : 'לא ניתן היה לשלוח כרגע את בקשת האיפוס.',
        );
      } finally {
        setIsSendingPasswordReset(
          false,
        );
      }
    };

  // displayedError — שגיאה.
  const displayedError =
    formError ?? error;

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <div
            className="auth-brand-icon"
            aria-hidden="true"
          >
            <LockKeyhole size={30} />
          </div>

          <div>
            <h1>צוות GVK</h1>

            <p>
              מערכת ניהול ושיבוץ משמרות
            </p>
          </div>
        </div>

        <div className="auth-card">
          <header className="auth-card-header">
            <h2>כניסה למערכת</h2>

            <p>
              הזן את פרטי המשתמש שלך כדי
              להמשיך.
            </p>
          </header>

          {displayedError ? (
            <div
              className="auth-error"
              role="alert"
              aria-live="assertive"
            >
              {displayedError}
            </div>
          ) : null}

          {passwordResetMessage ? (
            <div
              className="auth-success"
              role="status"
            >
              {passwordResetMessage}
            </div>
          ) : null}

          <form
            className="auth-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <Input
              id="login-email"
              label="כתובת אימייל"
              type="email"
              value={email}
              placeholder="name@example.com"
              autoComplete="email"
              startIcon={
                <Mail size={18} />
              }
              disabled={isSubmitting}
              onChange={(event) => {
                setEmail(
                  event.target.value,
                );

                setFormError(null);
                setPasswordResetMessage(
                  null,
                );
              }}
              required
            />

            <Input
              id="login-password"
              label="סיסמה"
              type="password"
              value={password}
              placeholder="הזן סיסמה"
              autoComplete="current-password"
              startIcon={
                <LockKeyhole size={18} />
              }
              disabled={isSubmitting}
              onChange={(event) => {
                setPassword(
                  event.target.value,
                );

                setFormError(null);
                setPasswordResetMessage(
                  null,
                );
              }}
              required
            />

            <div className="auth-forgot-password-row">
              <button
                type="button"
                className="auth-forgot-password-button"
                disabled={
                  isSubmitting ||
                  isSendingPasswordReset
                }
                onClick={() => {
                  void handleForgotPassword();
                }}
              >
                {
                  isSendingPasswordReset
                    ? 'שולח קישור לאיפוס...'
                    : 'שכחתי סיסמה'
                }
              </button>
            </div>

            <label className="auth-remember-row">
              <input
                type="checkbox"
                checked={rememberMe}
                disabled={isSubmitting}
                onChange={(event) => {
                  setRememberMe(
                    event.target.checked,
                  );
                }}
              />

              <span>
                <strong>זכור אותי</strong>
                <small>
                  השאר אותי מחובר גם לאחר סגירת האפליקציה במכשיר הזה.
                </small>
              </span>
            </label>

            <Button
              type="submit"
              className="auth-submit-button"
              disabled={
                isSubmitting ||
                isSendingPasswordReset
              }
            >
              <LogIn
                size={19}
                aria-hidden="true"
              />

              {isSubmitting
                ? 'מתחבר...'
                : 'כניסה למערכת'}
            </Button>
          </form>
        </div>

        <p className="auth-footer">
          המערכת מיועדת למשתמשים מורשים
          בלבד.
        </p>
      </section>
    </main>
  );
}

export default LoginPage;