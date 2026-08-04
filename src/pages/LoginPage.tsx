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
  Button,
  Input,
} from '../components/ui';
import '../styles/auth.css';



function LoginPage() {
  const navigate = useNavigate();

  const {
    signIn,
    error,
    clearError,
  } = useAuth();

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [formError, setFormError] =
    useState<string | null>(null);

  useEffect(() => {
    clearError();

    return () => {
      clearError();
    };
  }, [clearError]);

  const validateForm =
    (): string | null => {
      const normalizedEmail =
        email.trim();

      if (!normalizedEmail) {
        return 'יש להזין כתובת אימייל.';
      }

      if (!normalizedEmail.includes('@')) {
        return 'יש להזין כתובת אימייל תקינה.';
      }

      if (!password) {
        return 'יש להזין סיסמה.';
      }

      return null;
    };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    const validationError =
      validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    clearError();

    try {
      await signIn({
        email: email.trim(),
        password,
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
            <h1>GVK Shift Manager</h1>

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
            >
              {displayedError}
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
              }}
              required
            />

            <Button
              type="submit"
              className="auth-submit-button"
              disabled={isSubmitting}
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