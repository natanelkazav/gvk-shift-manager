import {
  KeyRound,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import {
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
import { authService } from '../services/authService';
import '../styles/change-password.css';

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה.';
}

function ChangePasswordPage() {
  const navigate = useNavigate();

  const {
    user,
    profile,
    refreshProfile,
    signOut,
  } = useAuth();

  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const validateForm =
    (): string | null => {
      if (!newPassword) {
        return 'יש להזין סיסמה חדשה.';
      }

      if (newPassword.length < 8) {
        return 'הסיסמה החדשה חייבת להכיל לפחות שמונה תווים.';
      }

      if (!confirmPassword) {
        return 'יש להזין את הסיסמה החדשה פעם נוספת.';
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
      event: FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault();

      const validationError =
        validateForm();

      if (validationError) {
        setError(validationError);
        return;
      }

      if (!user) {
        setError(
          'לא נמצאה התחברות פעילה. יש להתחבר מחדש.',
        );

        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        await authService.changePassword(
          user.id,
          newPassword,
        );

        await refreshProfile();

        navigate('/', {
          replace: true,
        });
      } catch (changePasswordError) {
        setError(
          getErrorMessage(
            changePasswordError,
          ),
        );
      } finally {
        setIsSaving(false);
      }
    };

  const handleSignOut =
    async (): Promise<void> => {
      if (isSaving) {
        return;
      }

      setError(null);

      try {
        await signOut();

        navigate('/login', {
          replace: true,
        });
      } catch (signOutError) {
        setError(
          getErrorMessage(
            signOutError,
          ),
        );
      }
    };

  return (
    <main className="change-password-page">
      <section className="change-password-card">
        <div className="change-password-icon">
          <ShieldCheck
            size={34}
            aria-hidden="true"
          />
        </div>

        <header className="change-password-header">
          <h1>שינוי סיסמה ראשוני</h1>

          <p>
            שלום{' '}
            <strong>
              {profile?.displayName ??
                'משתמש'}
            </strong>
            , לפני הכניסה למערכת יש לבחור
            סיסמה חדשה.
          </p>
        </header>

        {error ? (
          <div
            className="change-password-error"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <form
          className="change-password-form"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <Input
            id="new-password"
            label="סיסמה חדשה"
            type="password"
            value={newPassword}
            placeholder="לפחות שמונה תווים"
            autoComplete="new-password"
            startIcon={
              <KeyRound
                size={18}
                aria-hidden="true"
              />
            }
            disabled={isSaving}
            onChange={(event) => {
              setNewPassword(
                event.target.value,
              );

              if (error) {
                setError(null);
              }
            }}
          />

          <Input
            id="confirm-password"
            label="אימות סיסמה חדשה"
            type="password"
            value={confirmPassword}
            placeholder="הזן את הסיסמה שוב"
            autoComplete="new-password"
            startIcon={
              <KeyRound
                size={18}
                aria-hidden="true"
              />
            }
            disabled={isSaving}
            onChange={(event) => {
              setConfirmPassword(
                event.target.value,
              );

              if (error) {
                setError(null);
              }
            }}
          />

          <div className="change-password-guidance">
            הסיסמה חייבת להכיל לפחות שמונה
            תווים.
          </div>

          <Button
            type="submit"
            disabled={isSaving}
          >
            {isSaving
              ? 'מעדכן סיסמה...'
              : 'שמור סיסמה והמשך'}
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={isSaving}
            onClick={() => {
              void handleSignOut();
            }}
          >
            <LogOut
              size={18}
              aria-hidden="true"
            />

            התנתקות
          </Button>
        </form>
      </section>
    </main>
  );
}

export default ChangePasswordPage;