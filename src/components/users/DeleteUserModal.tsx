/**
 * קובץ: src/components/users/DeleteUserModal.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור משתמש.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DeleteUserModalProps, DeleteUserModal.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  AlertTriangle,
  LoaderCircle,
  Trash2,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  Button,
  Input,
} from '../ui';
import type {
  UserProfile,
} from '../../types/auth';

/**
 * חוזה הנתונים DeleteUserModalProps: משתמש / מאפייני הרכיב.
 */
interface DeleteUserModalProps {
  // user — משתמש.
  user: UserProfile | null;
  // isOpen — האם המצב פתוח.
  isOpen: boolean;
  isDeleting: boolean;
  // currentUserId — המשתמש הנוכחי הנוכחי.
  currentUserId: string | null;

  // onClose — פונקציית סגירת התצוגה.
  onClose: () => void;

  onDelete: (
    userId: string,
    reason: string | null,
  ) => Promise<void>;
}

// CONFIRMATION_TEXT — הנתון CONFIRMATION_TEXT בהקשר הפעולה.
const CONFIRMATION_TEXT = 'מחיקה';

/**
 * פעולה DeleteUserModal: מחיקת משתמש.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DeleteUserModal({
  user,
  isOpen,
  isDeleting,
  currentUserId,
  onClose,
  onDelete,
}: DeleteUserModalProps) {
  // מצב מקומי: confirmationValue — ערך; setConfirmationValue מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    confirmationValue,
    setConfirmationValue,
  ] = useState('');

  // מצב מקומי: deletionReason — הנתון deletionReason בהקשר הפעולה; setDeletionReason מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    deletionReason,
    setDeletionReason,
  ] = useState('');

  // מצב מקומי: formError — שגיאה; setFormError מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    formError,
    setFormError,
  ] = useState<string | null>(
    null,
  );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ isOpen, user, ].
  useEffect(() => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isOpen.
    if (!isOpen) {
      return;
    }

    setConfirmationValue('');
    setDeletionReason('');
    setFormError(null);
  }, [
    isOpen,
    user,
  ]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ isOpen, isDeleting, onClose, ].
  useEffect(() => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isOpen.
    if (!isOpen) {
      return;
    }

    /**
     * פעולה handleKeyDown: טיפול באירוע עבור מפתח.
     * @param event — אירוע.
     * @returns void — הפלט בהתאם לחתימה.
     */
    const handleKeyDown = (
      event: KeyboardEvent,
    ): void => {
      if (
        event.key === 'Escape' &&
        !isDeleting
      ) {
        onClose();
      }
    };

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    document.body.classList.add(
      'modal-open',
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );

      document.body.classList.remove(
        'modal-open',
      );
    };
  }, [
    isOpen,
    isDeleting,
    onClose,
  ]);

  // isCurrentUser — המשתמש הנוכחי.
  const isCurrentUser =
    Boolean(
      user &&
        user.id === currentUserId,
    );

  // ערך מחושב isConfirmationValid — הנתון isConfirmationValid בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const isConfirmationValid =
    useMemo(
      () =>
        confirmationValue.trim() ===
        CONFIRMATION_TEXT,
      [confirmationValue],
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isOpen || !user.
  if (
    !isOpen ||
    !user
  ) {
    return null;
  }

  /**
   * פעולה validateForm: בדיקת תקינות של הנתון validateForm בהקשר הפעולה.
   * @returns string | null — הפלט בהתאם לחתימה.
   */
  const validateForm =
    (): string | null => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCurrentUser.
      if (isCurrentUser) {
        return 'לא ניתן למחוק את המשתמש המחובר כעת.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isConfirmationValid.
      if (!isConfirmationValid) {
        return `יש להקליד את המילה "${CONFIRMATION_TEXT}" כדי לאשר את המחיקה.`;
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר deletionReason.trim().length > 500.
      if (
        deletionReason.trim().length >
        500
      ) {
        return 'סיבת המחיקה יכולה להכיל עד 500 תווים.';
      }

      return null;
    };

  /**
   * פעולה אסינכרונית handleSubmit: טיפול באירוע עבור הנתון handleSubmit בהקשר הפעולה.
   * @param event — אירוע.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleSubmit = async (
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    // validationError — אימות נתונים / שגיאה.
    const validationError =
      validateForm();

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר validationError.
    if (validationError) {
      setFormError(
        validationError,
      );

      return;
    }

    setFormError(null);

    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await onDelete(
        user.id,
        deletionReason.trim() ||
          null,
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'לא ניתן היה למחוק את המשתמש.',
      );
    }
  };

  /**
   * פעולה handleBackdropClick: טיפול באירוע עבור הנתון handleBackdropClick בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleBackdropClick =
    (): void => {
      if (!isDeleting) {
        onClose();
      }
    };

  return (
    <div
      className="edit-user-modal-backdrop"
      role="presentation"
      onMouseDown={
        handleBackdropClick
      }
    >
      <section
        className="delete-user-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="delete-user-modal-header">
          <div className="delete-user-modal-title">
            <div
              className="delete-user-modal-icon"
              aria-hidden="true"
            >
              <AlertTriangle
                size={23}
              />
            </div>

            <div>
              <h2 id="delete-user-title">
                מחיקת משתמש
              </h2>

              <p>
                פעולה זו אינה ניתנת
                לביטול.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="edit-user-modal-close"
            aria-label="סגירת חלון מחיקת משתמש"
            disabled={isDeleting}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <form
          className="delete-user-form"
          onSubmit={handleSubmit}
        >
          <div className="delete-user-warning">
            <AlertTriangle
              size={22}
              aria-hidden="true"
            />

            <div>
              <strong>
                המשתמש יימחק לצמיתות
              </strong>

              <span>
                חשבון ההתחברות,
                הפרופיל וההרשאות של
                המשתמש יימחקו מהמערכת.
              </span>
            </div>
          </div>

          <div className="delete-user-target">
            <div className="users-avatar">
              {user.displayName
                .trim()
                .charAt(0)
                .toUpperCase() ||
                '?'}
            </div>

            <div>
              <strong>
                {user.displayName}
              </strong>

              <span>
                {user.email}
              </span>

              <small>
                תפקיד: {user.role}
              </small>
            </div>
          </div>

          {isCurrentUser ? (
            <div
              className="edit-user-form-error"
              role="alert"
            >
              לא ניתן למחוק את
              המשתמש המחובר כעת.
            </div>
          ) : null}

          {formError ? (
            <div
              className="edit-user-form-error"
              role="alert"
            >
              {formError}
            </div>
          ) : null}

          <label className="delete-user-field">
            <span>
              סיבת המחיקה
              <small>
                {' '}
                — אופציונלי
              </small>
            </span>

            <textarea
              value={deletionReason}
              maxLength={500}
              rows={4}
              disabled={isDeleting}
              placeholder="לדוגמה: משתמש בדיקה, סיום העסקה או חשבון כפול"
              onChange={(event) => {
                setDeletionReason(
                  event.target.value,
                );

                setFormError(null);
              }}
            />

            <small>
              {deletionReason.length}
              /500
            </small>
          </label>

          <div className="delete-user-confirmation">
            <p>
              כדי לאשר, הקלד:
            </p>

            <code>
              {CONFIRMATION_TEXT}
            </code>

            <Input
              id="delete-user-confirmation"
              label="אישור מחיקה"
              type="text"
              value={
                confirmationValue
              }
              autoComplete="off"
              disabled={isDeleting}
              placeholder={CONFIRMATION_TEXT}
              onChange={(event) => {
                setConfirmationValue(
                  event.target.value,
                );

                setFormError(null);
              }}
            />
          </div>

          <footer className="delete-user-modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={onClose}
            >
              ביטול
            </Button>

            <Button
              type="submit"
              variant="danger"
              disabled={
                isDeleting ||
                isCurrentUser ||
                !isConfirmationValid
              }
            >
              {isDeleting ? (
                <LoaderCircle
                  size={18}
                  className="delete-user-loading-icon"
                  aria-hidden="true"
                />
              ) : (
                <Trash2
                  size={18}
                  aria-hidden="true"
                />
              )}

              {isDeleting
                ? 'מוחק משתמש...'
                : 'מחיקה לצמיתות'}
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default DeleteUserModal;