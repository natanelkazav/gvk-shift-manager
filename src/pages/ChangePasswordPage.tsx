/**
 * קובץ: src/pages/ChangePasswordPage.tsx
 * מטרה: מימוש מסך המשתמש עבור סיסמה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: getErrorMessage, ChangePasswordPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה.';
}

/**
 * פעולה ChangePasswordPage: סיסמה.
 */
function ChangePasswordPage() {
  const navigate = useNavigate();

  const {
    user,
    profile,
    refreshProfile,
    signOut,
  } = useAuth();

  // מצב מקומי: newPassword — סיסמה; setNewPassword מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  // מצב מקומי: confirmPassword — סיסמה; setConfirmPassword מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  // מצב מקומי: isSaving — האם שמירה מתבצעת; setIsSaving מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  /**
   * פעולה validateForm: בדיקת תקינות של הנתון validateForm בהקשר הפעולה.
   * @returns string | null — הפלט בהתאם לחתימה.
   */
  const validateForm =
    (): string | null => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !newPassword.
      if (!newPassword) {
        return 'יש להזין סיסמה חדשה.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר newPassword.length < 8.
      if (newPassword.length < 8) {
        return 'הסיסמה החדשה חייבת להכיל לפחות שמונה תווים.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmPassword.
      if (!confirmPassword) {
        return 'יש להזין את הסיסמה החדשה פעם נוספת.';
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
      event: FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault();

      // validationError — אימות נתונים / שגיאה.
      const validationError =
        validateForm();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר validationError.
      if (validationError) {
        setError(validationError);
        return;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !user.
      if (!user) {
        setError(
          'לא נמצאה התחברות פעילה. יש להתחבר מחדש.',
        );

        return;
      }

      setIsSaving(true);
      setError(null);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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

  /**
   * פעולה אסינכרונית handleSignOut: טיפול באירוע עבור הנתון handleSignOut בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleSignOut =
    async (): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isSaving.
      if (isSaving) {
        return;
      }

      setError(null);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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