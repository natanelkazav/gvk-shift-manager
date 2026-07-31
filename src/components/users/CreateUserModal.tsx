import {
  Save,
  UserPlus,
  X,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { Button, Input } from '../ui';
import type {
  UserRole,
} from '../../types/auth';
import type {
  CreateUserInput,
} from '../../types/users';

interface CreateUserModalProps {
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onCreate: (
    input: CreateUserInput,
  ) => Promise<void>;
}

interface CreateUserFormState {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  scheduleName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
}

const initialFormState:
  CreateUserFormState = {
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    scheduleName: '',
    role: 'dispatcher',
    isActive: true,
    mustChangePassword: true,
  };

const roleLabels: Record<
  UserRole,
  string
> = {
  admin: 'מנהל מערכת',
  manager: 'מנהלת',
  dispatcher: 'מוקדן',
  on_call: 'כונן',
  viewer: 'צפייה בלבד',
};

function CreateUserModal({
  isOpen,
  isSaving,
  onClose,
  onCreate,
}: CreateUserModalProps) {
  const [formState, setFormState] =
    useState<CreateUserFormState>(
      initialFormState,
    );

  const [formError, setFormError] =
    useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormState(initialFormState);
      setFormError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent,
    ): void => {
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

  if (!isOpen) {
    return null;
  }

  const validateForm =
    (): string | null => {
      const normalizedEmail =
        formState.email
          .trim()
          .toLowerCase();

      if (!formState.displayName.trim()) {
        return 'יש להזין שם תצוגה.';
      }

      if (
        formState.displayName.trim().length <
        2
      ) {
        return 'שם התצוגה חייב להכיל לפחות שני תווים.';
      }

      if (!normalizedEmail) {
        return 'יש להזין כתובת אימייל.';
      }

      if (
        !normalizedEmail.includes('@')
      ) {
        return 'כתובת האימייל אינה תקינה.';
      }

      if (!formState.password) {
        return 'יש להזין סיסמה זמנית.';
      }

      if (
        formState.password.length < 8
      ) {
        return 'הסיסמה חייבת להכיל לפחות שמונה תווים.';
      }

      if (
        formState.password !==
        formState.confirmPassword
      ) {
        return 'הסיסמאות אינן תואמות.';
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
      await onCreate({
        email:
          formState.email
            .trim()
            .toLowerCase(),

        password:
          formState.password,

        displayName:
          formState.displayName.trim(),

        scheduleName:
          formState.scheduleName.trim() ||
          null,

        role:
          formState.role,

        isActive:
          formState.isActive,

        mustChangePassword:
          formState
            .mustChangePassword,
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'לא ניתן היה ליצור את המשתמש.',
      );
    }
  };

  return (
    <div
      className="edit-user-modal-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!isSaving) {
          onClose();
        }
      }}
    >
      <section
        className="edit-user-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-user-title"
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
              <UserPlus size={22} />
            </div>

            <div>
              <h2 id="create-user-title">
                יצירת משתמש חדש
              </h2>

              <p>
                יצירת חשבון התחברות
                ופרופיל משתמש במערכת.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="edit-user-modal-close"
            aria-label="סגירת חלון יצירת משתמש"
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
              id="create-user-display-name"
              label="שם תצוגה"
              type="text"
              value={formState.displayName}
              disabled={isSaving}
              onChange={(event) => {
                setFormState(
                  (currentState) => ({
                    ...currentState,
                    displayName:
                      event.target.value,
                  }),
                );

                setFormError(null);
              }}
              required
            />

            <Input
              id="create-user-schedule-name"
              label="שם בשיבוץ"
              type="text"
              value={formState.scheduleName}
              placeholder="לדוגמה: נתנאל"
              disabled={isSaving}
              onChange={(event) => {
                setFormState(
                  (currentState) => ({
                    ...currentState,
                    scheduleName:
                      event.target.value,
                  }),
                );

                setFormError(null);
              }}
            />

            <Input
              id="create-user-email"
              label="כתובת אימייל"
              type="email"
              value={formState.email}
              placeholder="name@example.com"
              autoComplete="off"
              disabled={isSaving}
              onChange={(event) => {
                setFormState(
                  (currentState) => ({
                    ...currentState,
                    email:
                      event.target.value,
                  }),
                );

                setFormError(null);
              }}
              required
            />

            <label className="edit-user-field">
              <span>תפקיד</span>

              <select
                value={formState.role}
                disabled={isSaving}
                onChange={(event) => {
                  setFormState(
                    (currentState) => ({
                      ...currentState,
                      role:
                        event.target
                          .value as UserRole,
                    }),
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

            <Input
              id="create-user-password"
              label="סיסמה זמנית"
              type="password"
              value={formState.password}
              autoComplete="new-password"
              disabled={isSaving}
              onChange={(event) => {
                setFormState(
                  (currentState) => ({
                    ...currentState,
                    password:
                      event.target.value,
                  }),
                );

                setFormError(null);
              }}
              required
            />

            <Input
              id="create-user-confirm-password"
              label="אימות סיסמה"
              type="password"
              value={
                formState.confirmPassword
              }
              autoComplete="new-password"
              disabled={isSaving}
              onChange={(event) => {
                setFormState(
                  (currentState) => ({
                    ...currentState,
                    confirmPassword:
                      event.target.value,
                  }),
                );

                setFormError(null);
              }}
              required
            />
          </div>

          <div className="edit-user-options">
            <label className="edit-user-option">
              <input
                type="checkbox"
                checked={formState.isActive}
                disabled={isSaving}
                onChange={(event) => {
                  setFormState(
                    (currentState) => ({
                      ...currentState,
                      isActive:
                        event.target.checked,
                    }),
                  );
                }}
              />

              <span>
                <strong>
                  משתמש פעיל
                </strong>

                <small>
                  המשתמש יוכל להיכנס
                  למערכת מיד לאחר יצירתו.
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
                    (currentState) => ({
                      ...currentState,
                      mustChangePassword:
                        event.target.checked,
                    }),
                  );
                }}
              />

              <span>
                <strong>
                  דרוש שינוי סיסמה
                </strong>

                <small>
                  המשתמש יידרש לבחור
                  סיסמה חדשה לאחר הכניסה.
                </small>
              </span>
            </label>
          </div>

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
                ? 'יוצר משתמש...'
                : 'יצירת משתמש'}
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default CreateUserModal;