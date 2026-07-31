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

interface DeleteUserModalProps {
  user: UserProfile | null;
  isOpen: boolean;
  isDeleting: boolean;
  currentUserId: string | null;

  onClose: () => void;

  onDelete: (
    userId: string,
    reason: string | null,
  ) => Promise<void>;
}

const CONFIRMATION_TEXT = 'מחיקה';

function DeleteUserModal({
  user,
  isOpen,
  isDeleting,
  currentUserId,
  onClose,
  onDelete,
}: DeleteUserModalProps) {
  const [
    confirmationValue,
    setConfirmationValue,
  ] = useState('');

  const [
    deletionReason,
    setDeletionReason,
  ] = useState('');

  const [
    formError,
    setFormError,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

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

  const isCurrentUser =
    Boolean(
      user &&
        user.id === currentUserId,
    );

  const isConfirmationValid =
    useMemo(
      () =>
        confirmationValue.trim() ===
        CONFIRMATION_TEXT,
      [confirmationValue],
    );

  if (
    !isOpen ||
    !user
  ) {
    return null;
  }

  const validateForm =
    (): string | null => {
      if (isCurrentUser) {
        return 'לא ניתן למחוק את המשתמש המחובר כעת.';
      }

      if (!isConfirmationValid) {
        return `יש להקליד את המילה "${CONFIRMATION_TEXT}" כדי לאשר את המחיקה.`;
      }

      if (
        deletionReason.trim().length >
        500
      ) {
        return 'סיבת המחיקה יכולה להכיל עד 500 תווים.';
      }

      return null;
    };

  const handleSubmit = async (
    event:
      FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    const validationError =
      validateForm();

    if (validationError) {
      setFormError(
        validationError,
      );

      return;
    }

    setFormError(null);

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