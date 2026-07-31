import {
  Save,
  UserCog,
  X,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { Button, Input } from '../ui';
import type {
  UserProfile,
  UserRole,
} from '../../types/auth';
import type {
  UpdateUserProfileInput,
} from '../../types/users';

interface EditUserModalProps {
  user: UserProfile | null;
  isOpen: boolean;
  isSaving: boolean;
  currentUserId: string | null;
  onClose: () => void;
  onSave: (
    userId: string,
    input: UpdateUserProfileInput,
  ) => Promise<void>;
}

interface EditUserFormState {
  displayName: string;
  scheduleName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

const roleLabels: Record<UserRole, string> = {
  admin: 'מנהל מערכת',
  manager: 'מנהלת',
  dispatcher: 'מוקדן',
  on_call: 'כונן',
  viewer: 'צפייה בלבד',
};

function createFormState(
  user: UserProfile,
): EditUserFormState {
  return {
    displayName: user.displayName,
    scheduleName: user.scheduleName ?? '',
    role: user.role,
    isActive: user.isActive,
    mustChangePassword:
      user.mustChangePassword,
  };
}

function EditUserModal({
  user,
  isOpen,
  isSaving,
  currentUserId,
  onClose,
  onSave,
}: EditUserModalProps) {
  const [formState, setFormState] =
    useState<EditUserFormState | null>(
      user ? createFormState(user) : null,
    );

  const [formError, setFormError] =
    useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFormState(createFormState(user));
      setFormError(null);
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key === 'Escape' &&
        !isSaving
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
  }, [isOpen, isSaving, onClose]);

  if (
    !isOpen ||
    !user ||
    !formState
  ) {
    return null;
  }

  const isCurrentUser =
    user.id === currentUserId;

  const validateForm =
    (): string | null => {
      if (!formState.displayName.trim()) {
        return 'יש להזין שם תצוגה.';
      }

      if (
        formState.displayName.trim().length <
        2
      ) {
        return 'שם התצוגה חייב להכיל לפחות שני תווים.';
      }

      if (
        isCurrentUser &&
        !formState.isActive
      ) {
        return 'לא ניתן להשבית את המשתמש המחובר כעת.';
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

    setFormError(null);

    try {
      await onSave(user.id, {
        displayName:
          formState.displayName.trim(),

        scheduleName:
          formState.scheduleName.trim() ||
          null,

        role: formState.role,

        isActive:
          formState.isActive,

        mustChangePassword:
          formState.mustChangePassword,
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'לא ניתן היה לשמור את השינויים.',
      );
    }
  };

  const handleBackdropClick = () => {
    if (!isSaving) {
      onClose();
    }
  };

  return (
    <div
      className="edit-user-modal-backdrop"
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <section
        className="edit-user-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      >
        <header className="edit-user-modal-header">
          <div className="edit-user-modal-title">
            <div
              className="edit-user-modal-icon"
              aria-hidden="true"
            >
              <UserCog size={22} />
            </div>

            <div>
              <h2 id="edit-user-title">
                עריכת משתמש
              </h2>

              <p>{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            className="edit-user-modal-close"
            aria-label="סגירת חלון עריכת משתמש"
            disabled={isSaving}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <form
          className="edit-user-form"
          onSubmit={handleSubmit}
        >
          {formError ? (
            <div
              className="edit-user-form-error"
              role="alert"
            >
              {formError}
            </div>
          ) : null}

          <div className="edit-user-form-grid">
            <Input
              id="edit-user-display-name"
              label="שם תצוגה"
              type="text"
              value={formState.displayName}
              disabled={isSaving}
              onChange={(event) => {
                setFormState(
                  (currentState) =>
                    currentState
                      ? {
                          ...currentState,
                          displayName:
                            event.target.value,
                        }
                      : currentState,
                );

                setFormError(null);
              }}
              required
            />

            <Input
              id="edit-user-schedule-name"
              label="שם בשיבוץ"
              type="text"
              value={formState.scheduleName}
              placeholder="לדוגמה: נתנאל"
              disabled={isSaving}
              onChange={(event) => {
                setFormState(
                  (currentState) =>
                    currentState
                      ? {
                          ...currentState,
                          scheduleName:
                            event.target.value,
                        }
                      : currentState,
                );

                setFormError(null);
              }}
            />

            <label className="edit-user-field">
              <span>תפקיד</span>

              <select
                value={formState.role}
                disabled={isSaving}
                onChange={(event) => {
                  setFormState(
                    (currentState) =>
                      currentState
                        ? {
                            ...currentState,
                            role:
                              event.target
                                .value as UserRole,
                          }
                        : currentState,
                  );

                  setFormError(null);
                }}
              >
                {(
                  Object.entries(
                    roleLabels,
                  ) as Array<
                    [UserRole, string]
                  >
                ).map(
                  ([
                    roleValue,
                    roleLabel,
                  ]) => (
                    <option
                      key={roleValue}
                      value={roleValue}
                    >
                      {roleLabel}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          <div className="edit-user-options">
            <label className="edit-user-option">
              <input
                type="checkbox"
                checked={formState.isActive}
                disabled={
                  isSaving ||
                  isCurrentUser
                }
                onChange={(event) => {
                  setFormState(
                    (currentState) =>
                      currentState
                        ? {
                            ...currentState,
                            isActive:
                              event.target
                                .checked,
                          }
                        : currentState,
                  );

                  setFormError(null);
                }}
              />

              <span>
                <strong>
                  משתמש פעיל
                </strong>

                <small>
                  משתמש פעיל יכול להיכנס
                  למערכת ולהשתמש בהרשאות
                  שהוגדרו לו.
                </small>
              </span>
            </label>

            <label className="edit-user-option">
              <input
                type="checkbox"
                checked={
                  formState
                    .mustChangePassword
                }
                disabled={isSaving}
                onChange={(event) => {
                  setFormState(
                    (currentState) =>
                      currentState
                        ? {
                            ...currentState,
                            mustChangePassword:
                              event.target
                                .checked,
                          }
                        : currentState,
                  );

                  setFormError(null);
                }}
              />

              <span>
                <strong>
                  דרוש שינוי סיסמה
                </strong>

                <small>
                  המשתמש יידרש להחליף את
                  סיסמתו לאחר הכניסה
                  הבאה.
                </small>
              </span>
            </label>
          </div>

          {isCurrentUser ? (
            <div className="edit-user-current-user-note">
              לא ניתן להשבית את המשתמש
              המחובר כעת.
            </div>
          ) : null}

          <footer className="edit-user-modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              onClick={onClose}
            >
              ביטול
            </Button>

            <Button
              type="submit"
              disabled={isSaving}
            >
              <Save
                size={18}
                aria-hidden="true"
              />

              {isSaving
                ? 'שומר...'
                : 'שמירת שינויים'}
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default EditUserModal;