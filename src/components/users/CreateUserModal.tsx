import {
  KeyRound,
  LoaderCircle,
  Save,
  UserPlus,
  UserRound,
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
import UserPermissionsTab from './UserPermissionsTab';
import {
  arePermissionListsEqual,
  getDefaultPermissionsForRole,
  ROLE_LABELS,
} from '../../config/defaultRolePermissions';
import type {
  PermissionKey,
  UserRole,
} from '../../types/auth';
import type {
  CreateUserInput,
} from '../../types/users';

import './EditUserModalTabs.css';

interface CreateUserModalProps {
  isOpen: boolean;
  isSaving: boolean;

  onClose: () => void;

  onCreate: (
    input: CreateUserInput,
    permissions: PermissionKey[],
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

type CreateUserTab =
  | 'details'
  | 'permissions';

const INITIAL_ROLE:
  UserRole = 'dispatcher';

const initialFormState:
  CreateUserFormState = {
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    scheduleName: '',
    role: INITIAL_ROLE,
    isActive: true,
    mustChangePassword: true,
  };

function CreateUserModal({
  isOpen,
  isSaving,
  onClose,
  onCreate,
}: CreateUserModalProps) {
  const [
    activeTab,
    setActiveTab,
  ] = useState<CreateUserTab>(
    'details',
  );

  const [
    formState,
    setFormState,
  ] = useState<CreateUserFormState>(
    initialFormState,
  );

  const [
    selectedPermissions,
    setSelectedPermissions,
  ] = useState<PermissionKey[]>(
    () =>
      getDefaultPermissionsForRole(
        INITIAL_ROLE,
      ),
  );

  const [
    formError,
    setFormError,
  ] = useState<string | null>(
    null,
  );

  const [
    permissionsNotice,
    setPermissionsNotice,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormState({
      ...initialFormState,
    });

    setSelectedPermissions(
      getDefaultPermissionsForRole(
        INITIAL_ROLE,
      ),
    );

    setFormError(null);
    setPermissionsNotice(null);
    setActiveTab('details');
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
  }, [
    isOpen,
    isSaving,
    onClose,
  ]);

  const defaultPermissions =
    useMemo(
      () =>
        getDefaultPermissionsForRole(
          formState.role,
        ),
      [formState.role],
    );

  const usesDefaultPermissions =
    useMemo(
      () =>
        arePermissionListsEqual(
          selectedPermissions,
          defaultPermissions,
        ),
      [
        selectedPermissions,
        defaultPermissions,
      ],
    );

  if (!isOpen) {
    return null;
  }

  const validateForm =
    (): string | null => {
      const normalizedDisplayName =
        formState.displayName.trim();

      const normalizedEmail =
        formState.email
          .trim()
          .toLowerCase();

      if (!normalizedDisplayName) {
        return 'יש להזין שם תצוגה.';
      }

      if (
        normalizedDisplayName.length <
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

      setActiveTab('details');
      return;
    }

    setFormError(null);

    try {
      await onCreate(
        {
          email:
            formState.email
              .trim()
              .toLowerCase(),

          password:
            formState.password,

          displayName:
            formState.displayName
              .trim(),

          scheduleName:
            formState.scheduleName
              .trim() ||
            null,

          role:
            formState.role,

          isActive:
            formState.isActive,

          mustChangePassword:
            formState
              .mustChangePassword,
        },
        selectedPermissions,
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'לא ניתן היה ליצור את המשתמש.',
      );
    }
  };

  const handleRoleChange = (
    nextRole: UserRole,
  ): void => {
    const nextPermissions =
      getDefaultPermissionsForRole(
        nextRole,
      );

    setFormState(
      (currentState) => ({
        ...currentState,
        role: nextRole,
      }),
    );

    setSelectedPermissions(
      nextPermissions,
    );

    setFormError(null);

    setPermissionsNotice(
      `הוחלו הרשאות ברירת המחדל של התפקיד "${ROLE_LABELS[nextRole]}". ניתן לערוך אותן לפני יצירת המשתמש.`,
    );
  };

  const handleApplyRoleDefaults =
    (): void => {
      setSelectedPermissions(
        getDefaultPermissionsForRole(
          formState.role,
        ),
      );

      setFormError(null);

      setPermissionsNotice(
        `הרשאות ברירת המחדל של התפקיד "${ROLE_LABELS[formState.role]}" הוחלו מחדש.`,
      );
    };

  const handleTabChange = (
    tab: CreateUserTab,
  ): void => {
    if (isSaving) {
      return;
    }

    setActiveTab(tab);
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
        className="edit-user-modal edit-user-modal-with-tabs"
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
                יצירת חשבון, פרופיל
                והרשאות במערכת.
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

        <div
          className="edit-user-tabs"
          role="tablist"
          aria-label="אפשרויות יצירת משתמש"
        >
          <button
            type="button"
            role="tab"
            id="create-user-details-tab"
            aria-selected={
              activeTab === 'details'
            }
            aria-controls="create-user-details-panel"
            className={[
              'edit-user-tab',
              activeTab === 'details'
                ? 'edit-user-tab-active'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={isSaving}
            onClick={() => {
              handleTabChange(
                'details',
              );
            }}
          >
            <UserRound
              size={18}
              aria-hidden="true"
            />

            <span>
              פרטי משתמש
            </span>
          </button>

          <button
            type="button"
            role="tab"
            id="create-user-permissions-tab"
            aria-selected={
              activeTab ===
              'permissions'
            }
            aria-controls="create-user-permissions-panel"
            className={[
              'edit-user-tab',
              activeTab ===
                'permissions'
                ? 'edit-user-tab-active'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={isSaving}
            onClick={() => {
              handleTabChange(
                'permissions',
              );
            }}
          >
            <KeyRound
              size={18}
              aria-hidden="true"
            />

            <span>הרשאות</span>

            <span className="create-user-permissions-count">
              {
                selectedPermissions
                  .length
              }
            </span>
          </button>
        </div>

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

          {permissionsNotice ? (
            <div
              className="edit-user-current-user-note"
              role="status"
            >
              {permissionsNotice}
            </div>
          ) : null}

          {activeTab ===
          'details' ? (
            <div
              id="create-user-details-panel"
              role="tabpanel"
              aria-labelledby="create-user-details-tab"
              className="edit-user-tab-panel"
            >
              <div className="edit-user-form-grid">
                <Input
                  id="create-user-display-name"
                  label="שם תצוגה"
                  type="text"
                  value={
                    formState.displayName
                  }
                  disabled={isSaving}
                  onChange={(
                    event,
                  ) => {
                    setFormState(
                      (
                        currentState,
                      ) => ({
                        ...currentState,

                        displayName:
                          event.target
                            .value,
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
                  value={
                    formState.scheduleName
                  }
                  placeholder="לדוגמה: נתנאל"
                  disabled={isSaving}
                  onChange={(
                    event,
                  ) => {
                    setFormState(
                      (
                        currentState,
                      ) => ({
                        ...currentState,

                        scheduleName:
                          event.target
                            .value,
                      }),
                    );

                    setFormError(null);
                  }}
                />

                <Input
                  id="create-user-email"
                  label="כתובת אימייל"
                  type="email"
                  value={
                    formState.email
                  }
                  placeholder="name@example.com"
                  autoComplete="off"
                  disabled={isSaving}
                  onChange={(
                    event,
                  ) => {
                    setFormState(
                      (
                        currentState,
                      ) => ({
                        ...currentState,

                        email:
                          event.target
                            .value,
                      }),
                    );

                    setFormError(null);
                  }}
                  required
                />

                <label className="edit-user-field">
                  <span>תפקיד</span>

                  <select
                    value={
                      formState.role
                    }
                    disabled={isSaving}
                    onChange={(
                      event,
                    ) => {
                      handleRoleChange(
                        event.target
                          .value as UserRole,
                      );
                    }}
                  >
                    {(
                      Object.entries(
                        ROLE_LABELS,
                      ) as Array<
                        [
                          UserRole,
                          string,
                        ]
                      >
                    ).map(
                      ([
                        roleValue,
                        roleLabel,
                      ]) => (
                        <option
                          key={
                            roleValue
                          }
                          value={
                            roleValue
                          }
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
                  value={
                    formState.password
                  }
                  autoComplete="new-password"
                  disabled={isSaving}
                  onChange={(
                    event,
                  ) => {
                    setFormState(
                      (
                        currentState,
                      ) => ({
                        ...currentState,

                        password:
                          event.target
                            .value,
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
                    formState
                      .confirmPassword
                  }
                  autoComplete="new-password"
                  disabled={isSaving}
                  onChange={(
                    event,
                  ) => {
                    setFormState(
                      (
                        currentState,
                      ) => ({
                        ...currentState,

                        confirmPassword:
                          event.target
                            .value,
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
                    checked={
                      formState.isActive
                    }
                    disabled={isSaving}
                    onChange={(
                      event,
                    ) => {
                      setFormState(
                        (
                          currentState,
                        ) => ({
                          ...currentState,

                          isActive:
                            event.target
                              .checked,
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
                      למערכת מיד לאחר
                      יצירתו.
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
                    onChange={(
                      event,
                    ) => {
                      setFormState(
                        (
                          currentState,
                        ) => ({
                          ...currentState,

                          mustChangePassword:
                            event.target
                              .checked,
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
                      סיסמה חדשה לאחר
                      הכניסה.
                    </small>
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div
              id="create-user-permissions-panel"
              role="tabpanel"
              aria-labelledby="create-user-permissions-tab"
              className="edit-user-tab-panel"
            >
              <div className="edit-user-current-user-note">
                <strong>
                  הרשאות לתפקיד:
                  {' '}
                  {
                    ROLE_LABELS[
                      formState.role
                    ]
                  }
                </strong>

                <div>
                  {usesDefaultPermissions
                    ? 'ההרשאות תואמות לברירת המחדל של התפקיד.'
                    : 'ההרשאות נערכו ידנית ואינן תואמות במלואן לברירת המחדל.'}
                </div>

                {!usesDefaultPermissions ? (
                  <div
                    style={{
                      marginTop:
                        '12px',
                    }}
                  >
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isSaving}
                      onClick={
                        handleApplyRoleDefaults
                      }
                    >
                      החלת ברירת המחדל
                    </Button>
                  </div>
                ) : null}
              </div>

              <UserPermissionsTab
                selectedPermissions={
                  selectedPermissions
                }
                isDisabled={isSaving}
                onChange={(
                  nextPermissions,
                ) => {
                  setSelectedPermissions(
                    nextPermissions,
                  );

                  setFormError(null);
                  setPermissionsNotice(
                    null,
                  );
                }}
              />
            </div>
          )}

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
              {isSaving ? (
                <LoaderCircle
                  size={18}
                  className="edit-user-permissions-loading-icon"
                  aria-hidden="true"
                />
              ) : (
                <Save
                  size={18}
                  aria-hidden="true"
                />
              )}

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