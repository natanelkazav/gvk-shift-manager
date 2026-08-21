import {
  KeyRound,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Save,
  UserCog,
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
  UserProfile,
  UserRole,
} from '../../types/auth';
import type {
  UpdateUserProfileInput,
} from '../../types/users';

import './EditUserModalTabs.css';

interface EditUserModalProps {
  user: UserProfile | null;
  isOpen: boolean;
  isSaving: boolean;
  currentUserId: string | null;
  canManagePayroll: boolean;

  permissions: PermissionKey[];

  isPermissionsLoading:
    boolean;

  permissionsError:
    string | null;

  onRetryPermissions:
    () => Promise<void>;

  onClose: () => void;

  onSave: (
    userId: string,
    input:
      UpdateUserProfileInput,
    permissions:
      PermissionKey[],
  ) => Promise<void>;
}

interface EditUserFormState {
  displayName: string;
  scheduleName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  hourlyRate: string;
  dailyDutyRate: string;
}

type EditUserTab =
  | 'details'
  | 'permissions';

function createFormState(
  user: UserProfile,
): EditUserFormState {
  return {
    displayName:
      user.displayName,

    scheduleName:
      user.scheduleName ?? '',

    role:
      user.role,

    isActive:
      user.isActive,

    mustChangePassword:
      user.mustChangePassword,

    hourlyRate:
      user.hourlyRate?.toString() ?? '',

    dailyDutyRate:
      user.dailyDutyRate?.toString() ?? '',
  };
}

function EditUserModal({
  user,
  isOpen,
  isSaving,
  currentUserId,
  canManagePayroll,
  permissions,
  isPermissionsLoading,
  permissionsError,
  onRetryPermissions,
  onClose,
  onSave,
}: EditUserModalProps) {
  const [
    activeTab,
    setActiveTab,
  ] = useState<EditUserTab>(
    'details',
  );

  const [
    formState,
    setFormState,
  ] =
    useState<EditUserFormState | null>(
      user
        ? createFormState(user)
        : null,
    );

  const [
    selectedPermissions,
    setSelectedPermissions,
  ] = useState<PermissionKey[]>(
    [],
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

  const [
    isRetryingPermissions,
    setIsRetryingPermissions,
  ] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    setFormState(
      createFormState(user),
    );

    setSelectedPermissions([]);
    setFormError(null);
    setPermissionsNotice(null);
    setIsRetryingPermissions(
      false,
    );
    setActiveTab('details');
  }, [user]);

  useEffect(() => {
    if (
      !isOpen ||
      isPermissionsLoading ||
      permissionsError
    ) {
      return;
    }

    setSelectedPermissions(
      permissions,
    );

    setPermissionsNotice(null);
  }, [
    isOpen,
    isPermissionsLoading,
    permissionsError,
    permissions,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

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
    useMemo<PermissionKey[]>(
      () =>
        formState
          ? getDefaultPermissionsForRole(
              formState.role,
            )
          : [],
      [formState],
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

  if (
    !isOpen ||
    !user ||
    !formState
  ) {
    return null;
  }

  const isCurrentUser =
    user.id === currentUserId;

  const isPermissionsUnavailable =
    isPermissionsLoading ||
    Boolean(permissionsError);

  const isInteractionDisabled =
    isSaving ||
    isPermissionsLoading ||
    isRetryingPermissions;

  const validateForm =
    (): string | null => {
      const normalizedDisplayName =
        formState.displayName.trim();

      if (!normalizedDisplayName) {
        return 'יש להזין שם תצוגה.';
      }

      if (
        normalizedDisplayName.length <
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

      if (isPermissionsLoading) {
        return 'יש להמתין לסיום טעינת ההרשאות.';
      }

      if (permissionsError) {
        return 'לא ניתן לשמור לפני שהרשאות המשתמש נטענו בהצלחה.';
      }

      if (
        canManagePayroll &&
        formState.role === 'dispatcher' &&
        formState.hourlyRate.trim() &&
        (
          !Number.isFinite(Number(formState.hourlyRate)) ||
          Number(formState.hourlyRate) < 0
        )
      ) {
        return 'השכר השעתי חייב להיות מספר חיובי.';
      }

      if (
        canManagePayroll &&
        formState.role === 'on_call' &&
        formState.dailyDutyRate.trim() &&
        (
          !Number.isFinite(Number(formState.dailyDutyRate)) ||
          Number(formState.dailyDutyRate) < 0
        )
      ) {
        return 'עלות הכוננות היומית חייבת להיות מספר חיובי.';
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

      if (
        isPermissionsUnavailable
      ) {
        setActiveTab(
          'permissions',
        );
      } else {
        setActiveTab('details');
      }

      return;
    }

    setFormError(null);

    try {
      await onSave(
        user.id,
        {
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

          ...(canManagePayroll &&
          formState.role === 'dispatcher'
            ? {
                hourlyRate:
                  formState.hourlyRate.trim()
                    ? Number(formState.hourlyRate)
                    : null,
              }
            : {}),

          ...(canManagePayroll &&
          formState.role === 'on_call'
            ? {
                dailyDutyRate:
                  formState.dailyDutyRate.trim()
                    ? Number(formState.dailyDutyRate)
                    : null,
              }
            : {}),
        },
        selectedPermissions,
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'לא ניתן היה לשמור את השינויים.',
      );
    }
  };

  const handleBackdropClick =
    (): void => {
      if (!isInteractionDisabled) {
        onClose();
      }
    };

  const handleTabChange = (
    tab: EditUserTab,
  ): void => {
    if (isInteractionDisabled) {
      return;
    }

    setActiveTab(tab);
  };

  const handleRoleChange = (
    nextRole: UserRole,
  ): void => {
    const previousRole =
      formState.role;

    setFormState(
      (currentState) =>
        currentState
          ? {
              ...currentState,
              role: nextRole,
            }
          : currentState,
    );

    setFormError(null);

    if (
      previousRole !== nextRole
    ) {
      setPermissionsNotice(
        `התפקיד שונה ל־${ROLE_LABELS[nextRole]}. ההרשאות הקיימות לא שונו. ניתן לעבור לטאב ההרשאות ולהחיל את ברירת המחדל של התפקיד החדש.`,
      );
    }
  };

  const handleApplyRoleDefaults =
    (): void => {
      const nextPermissions =
        getDefaultPermissionsForRole(
          formState.role,
        );

      setSelectedPermissions(
        nextPermissions,
      );

      setFormError(null);

      setPermissionsNotice(
        `הרשאות ברירת המחדל של התפקיד "${ROLE_LABELS[formState.role]}" הוחלו. השינוי יישמר רק לאחר לחיצה על "שמירת שינויים".`,
      );
    };

  const handleRetryPermissions =
    async (): Promise<void> => {
      if (
        isRetryingPermissions ||
        isSaving
      ) {
        return;
      }

      setIsRetryingPermissions(true);
      setFormError(null);
      setPermissionsNotice(null);

      try {
        await onRetryPermissions();
      } catch (error) {
        setFormError(
          error instanceof Error
            ? error.message
            : 'לא ניתן היה לטעון מחדש את ההרשאות.',
        );
      } finally {
        setIsRetryingPermissions(
          false,
        );
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
        className="edit-user-modal edit-user-modal-with-tabs"
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
            disabled={
              isInteractionDisabled
            }
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        <div
          className="edit-user-tabs"
          role="tablist"
          aria-label="אפשרויות עריכת משתמש"
        >
          <button
            type="button"
            role="tab"
            id="edit-user-details-tab"
            aria-selected={
              activeTab === 'details'
            }
            aria-controls="edit-user-details-panel"
            className={[
              'edit-user-tab',
              activeTab === 'details'
                ? 'edit-user-tab-active'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={
              isInteractionDisabled
            }
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
            id="edit-user-permissions-tab"
            aria-selected={
              activeTab ===
              'permissions'
            }
            aria-controls="edit-user-permissions-panel"
            className={[
              'edit-user-tab',
              activeTab ===
                'permissions'
                ? 'edit-user-tab-active'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={
              isSaving ||
              isRetryingPermissions
            }
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

            {isPermissionsLoading ? (
              <LoaderCircle
                size={15}
                className="edit-user-permissions-loading-icon"
                aria-hidden="true"
              />
            ) : null}
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
              id="edit-user-details-panel"
              role="tabpanel"
              aria-labelledby="edit-user-details-tab"
              className="edit-user-tab-panel"
            >
              <div className="edit-user-form-grid">
                <Input
                  id="edit-user-display-name"
                  label="שם תצוגה"
                  type="text"
                  value={
                    formState.displayName
                  }
                  disabled={
                    isInteractionDisabled
                  }
                  onChange={(
                    event,
                  ) => {
                    setFormState(
                      (
                        currentState,
                      ) =>
                        currentState
                          ? {
                              ...currentState,

                              displayName:
                                event
                                  .target
                                  .value,
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
                  value={
                    formState.scheduleName
                  }
                  placeholder="לדוגמה: נתנאל"
                  disabled={
                    isInteractionDisabled
                  }
                  onChange={(
                    event,
                  ) => {
                    setFormState(
                      (
                        currentState,
                      ) =>
                        currentState
                          ? {
                              ...currentState,

                              scheduleName:
                                event
                                  .target
                                  .value,
                            }
                          : currentState,
                    );

                    setFormError(null);
                  }}
                />

                {canManagePayroll &&
                formState.role === 'dispatcher' ? (
                  <Input
                    id="edit-user-hourly-rate"
                    label="שכר שעתי (₪)"
                    type="number"
                    value={formState.hourlyRate}
                    min="0"
                    step="0.01"
                    disabled={isSaving}
                    onChange={(event) => {
                      setFormState(
                        (currentState) =>
                          currentState
                            ? {
                                ...currentState,
                                hourlyRate:
                                  event.target.value,
                              }
                            : currentState,
                      );
                      setFormError(null);
                    }}
                  />
                ) : null}

                {canManagePayroll &&
                formState.role === 'on_call' ? (
                  <Input
                    id="edit-user-daily-duty-rate"
                    label="עלות כוננות יומית (₪)"
                    type="number"
                    value={formState.dailyDutyRate}
                    min="0"
                    step="0.01"
                    disabled={isSaving}
                    onChange={(event) => {
                      setFormState(
                        (currentState) =>
                          currentState
                            ? {
                                ...currentState,
                                dailyDutyRate:
                                  event.target.value,
                              }
                            : currentState,
                      );
                      setFormError(null);
                    }}
                  />
                ) : null}

                <label className="edit-user-field">
                  <span>תפקיד</span>

                  <select
                    value={
                      formState.role
                    }
                    disabled={
                      isInteractionDisabled
                    }
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
              </div>

              <div className="edit-user-options">
                <label className="edit-user-option">
                  <input
                    type="checkbox"
                    checked={
                      formState.isActive
                    }
                    disabled={
                      isInteractionDisabled ||
                      isCurrentUser
                    }
                    onChange={(
                      event,
                    ) => {
                      setFormState(
                        (
                          currentState,
                        ) =>
                          currentState
                            ? {
                                ...currentState,

                                isActive:
                                  event
                                    .target
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
                      משתמש פעיל יכול
                      להיכנס למערכת
                      ולהשתמש בהרשאות
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
                    disabled={
                      isInteractionDisabled
                    }
                    onChange={(
                      event,
                    ) => {
                      setFormState(
                        (
                          currentState,
                        ) =>
                          currentState
                            ? {
                                ...currentState,

                                mustChangePassword:
                                  event
                                    .target
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
                      המשתמש יידרש
                      להחליף את סיסמתו
                      לאחר הכניסה הבאה.
                    </small>
                  </span>
                </label>
              </div>

              {isCurrentUser ? (
                <div className="edit-user-current-user-note">
                  לא ניתן להשבית את
                  המשתמש המחובר כעת.
                </div>
              ) : null}
            </div>
          ) : (
            <div
              id="edit-user-permissions-panel"
              role="tabpanel"
              aria-labelledby="edit-user-permissions-tab"
              className="edit-user-tab-panel"
            >
              {isPermissionsLoading ||
              isRetryingPermissions ? (
                <div
                  className="edit-user-permissions-status"
                  role="status"
                  aria-live="polite"
                >
                  <LoaderCircle
                    size={28}
                    className="edit-user-permissions-loading-icon"
                    aria-hidden="true"
                  />

                  <strong>
                    טוען הרשאות
                  </strong>

                  <span>
                    יש להמתין בזמן
                    שהרשאות המשתמש
                    נטענות.
                  </span>
                </div>
              ) : permissionsError ? (
                <div
                  className="edit-user-permissions-status edit-user-permissions-error"
                  role="alert"
                >
                  <KeyRound
                    size={28}
                    aria-hidden="true"
                  />

                  <strong>
                    טעינת ההרשאות נכשלה
                  </strong>

                  <span>
                    {permissionsError}
                  </span>

                  <Button
                    type="button"
                    variant="secondary"
                    disabled={
                      isRetryingPermissions ||
                      isSaving
                    }
                    onClick={() => {
                      void handleRetryPermissions();
                    }}
                  >
                    <RefreshCw
                      size={17}
                      aria-hidden="true"
                    />

                    ניסיון חוזר
                  </Button>
                </div>
              ) : (
                <>
                  <div className="edit-user-current-user-note">
                    <strong>
                      ברירת מחדל לתפקיד:
                      {' '}
                      {
                        ROLE_LABELS[
                          formState.role
                        ]
                      }
                    </strong>

                    <div>
                      {usesDefaultPermissions
                        ? 'ההרשאות הנוכחיות תואמות לברירת המחדל של התפקיד.'
                        : 'ההרשאות הנוכחיות מותאמות אישית ואינן תואמות במלואן לברירת המחדל של התפקיד.'}
                    </div>

                    <div
                      style={{
                        marginTop:
                          '12px',
                      }}
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={
                          isSaving ||
                          usesDefaultPermissions
                        }
                        onClick={
                          handleApplyRoleDefaults
                        }
                      >
                        <RotateCcw
                          size={17}
                          aria-hidden="true"
                        />

                        החלת ברירת המחדל
                      </Button>
                    </div>
                  </div>

                  <UserPermissionsTab
                    selectedPermissions={
                      selectedPermissions
                    }
                    isDisabled={
                      isSaving
                    }
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
                </>
              )}
            </div>
          )}

          <footer className="edit-user-modal-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={
                isInteractionDisabled
              }
              onClick={onClose}
            >
              ביטול
            </Button>

            <Button
              type="submit"
              disabled={
                isInteractionDisabled ||
                Boolean(
                  permissionsError,
                )
              }
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
                ? 'שומר...'
                : isPermissionsLoading
                  ? 'טוען הרשאות...'
                  : 'שמירת שינויים'}
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default EditUserModal;