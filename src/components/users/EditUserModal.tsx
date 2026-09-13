import {
  BriefcaseBusiness,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Save,
  UserCog,
  UserRound,
  X,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import {
  Button,
  Input,
} from '../ui';
import UserPermissionsTab from './UserPermissionsTab';
import DynamicUserJobTypePermissions from './dynamic/DynamicUserJobTypePermissions';
import DynamicUserAssignmentsEditor from './dynamic/DynamicUserAssignmentsEditor';
import {
  ROLE_LABELS,
} from '../../config/defaultRolePermissions';
import type {
  PermissionKey,
  UserProfile,
  UserRole,
} from '../../types/auth';
import { dynamicPermissionEngineService } from '../../services/dynamicPermissionEngineService';
import type {
  DynamicUserJobTypePermissionEditor,
  DynamicUserJobTypePermissionSelection,
} from '../../types/dynamicPermissionEngine';
import type { UpdateUserProfileInput } from '../../types/users';
import type { DynamicJobType } from '../../types/dynamicScheduling';
import type { DynamicUserAssignmentSelection } from '../../types/dynamicUserAssignments';
import { dynamicUserAssignmentsService } from '../../services/dynamicUserAssignmentsService';
import {
  accountTypeFromLegacyRole,
  legacyRoleForAccountType,
  SYSTEM_ACCOUNT_DESCRIPTIONS,
  SYSTEM_ACCOUNT_LABELS,
  type SystemAccountType,
} from '../../config/systemAccountTypes';

import './EditUserModalTabs.css';

const SYSTEM_PERMISSION_KEYS: PermissionKey[] = [
  'dashboard.view',
  'notifications.view',
  'notifications.manage',
  'users.view',
  'users.manage',
  'schedule_import.manage',
  'schedule_export.manage',
  'archive.view',
  'audit.view',
  'attendance.view',
  'attendance.manage',
];

interface EditUserModalProps {
  user: UserProfile | null;
  dynamicJobTypes: DynamicJobType[];
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
    dynamicJobTypePermissions:
      DynamicUserJobTypePermissionSelection[],
    assignments: DynamicUserAssignmentSelection[],
  ) => Promise<void>;
}

interface EditUserFormState {
  email: string;
  displayName: string;
  scheduleName: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  hourlyRate: string;
  dailyDutyRate: string;
  morningShiftRate: string;
}

type EditUserTab =
  | 'details'
  | 'assignments'
  | 'permissions';

function createFormState(
  user: UserProfile,
): EditUserFormState {
  return {
    email:
      user.email,

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

    morningShiftRate:
      user.morningShiftRate?.toString() ?? '',
  };
}

function EditUserModal({
  user,
  dynamicJobTypes,
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

  const [dynamicPermissionEditor, setDynamicPermissionEditor] =
    useState<DynamicUserJobTypePermissionEditor>({ jobTypes: [] });
  const [assignments, setAssignments] = useState<DynamicUserAssignmentSelection[]>([]);
  const [isAssignmentsLoading, setIsAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  const [isDynamicPermissionSummaryLoading, setIsDynamicPermissionSummaryLoading] =
    useState(false);
  const [dynamicPermissionSummaryError, setDynamicPermissionSummaryError] =
    useState<string | null>(null);

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
    setDynamicPermissionEditor({ jobTypes: [] });
    setDynamicPermissionSummaryError(null);
    setAssignments([]);
    setAssignmentsError(null);
    setActiveTab('details');
  }, [user]);

  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelled = false;
    setIsDynamicPermissionSummaryLoading(true);
    setDynamicPermissionSummaryError(null);
    void dynamicPermissionEngineService.getUserJobTypePermissionEditor(user.id)
      .then((editor) => { if (!cancelled) setDynamicPermissionEditor(editor); })
      .catch((error: unknown) => {
        if (!cancelled) setDynamicPermissionSummaryError(error instanceof Error ? error.message : 'לא ניתן לטעון הרשאות דינמיות.');
      })
      .finally(() => { if (!cancelled) setIsDynamicPermissionSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen || !user) return;
    let cancelled = false;
    setIsAssignmentsLoading(true);
    setAssignmentsError(null);
    void dynamicUserAssignmentsService.getEditor(user.id)
      .then((editor) => {
        if (!cancelled) {
          setAssignments(editor.assignments.map((item) => ({
            jobTypeId: item.jobTypeId,
            isMember: item.isMember,
            isManager: item.isManager,
            employmentScope: item.employmentScope,
            partTimeDefinition: item.partTimeDefinition,
          })));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setAssignmentsError(error instanceof Error ? error.message : 'לא ניתן לטעון שיוכי תפקידים.');
      })
      .finally(() => { if (!cancelled) setIsAssignmentsLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, user]);

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
    isAssignmentsLoading ||
    isRetryingPermissions;

  const validateForm =
    (): string | null => {
      const normalizedEmail =
        formState.email
          .trim()
          .toLowerCase();

      const normalizedDisplayName =
        formState.displayName.trim();

      if (
        !normalizedEmail ||
        !normalizedEmail.includes(
          '@',
        )
      ) {
        return 'יש להזין כתובת אימייל תקינה.';
      }

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
        formState.role === 'morning_driver' &&
        formState.morningShiftRate.trim() &&
        (
          !Number.isFinite(Number(formState.morningShiftRate)) ||
          Number(formState.morningShiftRate) < 0
        )
      ) {
        return 'התעריף למשמרת בוקר חייב להיות מספר חיובי.';
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
          email:
            formState.email
              .trim()
              .toLowerCase(),

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
          formState.role === 'morning_driver'
            ? {
                morningShiftRate:
                  formState.morningShiftRate.trim()
                    ? Number(formState.morningShiftRate)
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
        dynamicPermissionEditor.jobTypes.flatMap((jobType) =>
          jobType.permissions.map((permission) => ({
            jobTypeId: jobType.jobTypeId,
            permissionKey: permission.permissionKey,
            enabled: permission.enabled,
          })),
        ),
           assignments,
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

  const handleAccountTypeChange = (nextAccountType: SystemAccountType): void => {
    handleRoleChange(legacyRoleForAccountType(nextAccountType, formState.role));
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
        `התפקיד הישן שונה ל־${ROLE_LABELS[nextRole]}. הרשאות העבודה הדינמיות אינן מושפעות מה-role הישן ונגזרות מה-Job Types.`,
      );
    }
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

              <p>{formState.email}</p>
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
            id="edit-user-assignments-tab"
            aria-selected={activeTab === 'assignments'}
            aria-controls="edit-user-assignments-panel"
            className={[
              'edit-user-tab',
              activeTab === 'assignments' ? 'edit-user-tab-active' : '',
            ].filter(Boolean).join(' ')}
            disabled={isSaving || isAssignmentsLoading}
            onClick={() => handleTabChange('assignments')}
          >
            <BriefcaseBusiness size={18} aria-hidden="true" />
            <span>תפקידים</span>
            <span className="create-user-permissions-count">
              {assignments.filter((item) => item.isMember || item.isManager).length}
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
                  id="edit-user-email"
                  label="כתובת אימייל"
                  type="email"
                  value={
                    formState.email
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

                              email:
                                event
                                  .target
                                  .value,
                            }
                          : currentState,
                    );

                    setFormError(
                      null,
                    );
                  }}
                  required
                />

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
                formState.role === 'morning_driver' ? (
                  <Input
                    id="edit-user-morning-shift-rate"
                    label="תעריף למשמרת בוקר (₪)"
                    type="number"
                    value={formState.morningShiftRate}
                    min="0"
                    step="0.01"
                    disabled={isSaving}
                    onChange={(event) => {
                      setFormState(
                        (currentState) =>
                          currentState
                            ? {
                                ...currentState,
                                morningShiftRate:
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
                  <span>סוג חשבון</span>

                  <select
                    value={accountTypeFromLegacyRole(formState.role)}
                    disabled={isInteractionDisabled}
                    onChange={(event) => handleAccountTypeChange(event.target.value as SystemAccountType)}
                  >
                    {(Object.entries(SYSTEM_ACCOUNT_LABELS) as Array<[SystemAccountType, string]>).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <small>{SYSTEM_ACCOUNT_DESCRIPTIONS[accountTypeFromLegacyRole(formState.role)]}</small>
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
          ) : activeTab === 'assignments' ? (
            <div
              id="edit-user-assignments-panel"
              role="tabpanel"
              aria-labelledby="edit-user-assignments-tab"
              className="edit-user-tab-panel"
            >
              {isAssignmentsLoading ? (
                <div className="edit-user-permissions-status" role="status">
                  <LoaderCircle size={26} className="edit-user-permissions-loading-icon" aria-hidden="true" />
                  <strong>טוען תפקידי עבודה</strong>
                </div>
              ) : assignmentsError ? (
                <div className="edit-user-permissions-status edit-user-permissions-error" role="alert">
                  <BriefcaseBusiness size={28} aria-hidden="true" />
                  <strong>טעינת התפקידים נכשלה</strong>
                  <span>{assignmentsError}</span>
                </div>
              ) : (
                <DynamicUserAssignmentsEditor
                  jobTypes={dynamicJobTypes}
                  assignments={assignments}
                  isDisabled={isSaving}
                  onChange={setAssignments}
                />
              )}
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
                  <div className="permission-policy-card dynamic-inherited-permissions-card">
                    {isDynamicPermissionSummaryLoading ? (
                      <div className="permission-policy-note">טוען הרשאות דינמיות…</div>
                    ) : dynamicPermissionSummaryError ? (
                      <div className="permission-policy-note permission-policy-note-error">{dynamicPermissionSummaryError}</div>
                    ) : (
                      <DynamicUserJobTypePermissions
                        editor={dynamicPermissionEditor}
                        isDisabled={isSaving}
                        onChange={(nextPermissions) => {
                          const nextMap = new Map(
                            nextPermissions.map((permission) => [
                              `${permission.jobTypeId}:${permission.permissionKey}`,
                              permission.enabled,
                            ]),
                          );

                          setDynamicPermissionEditor((current) => ({
                            jobTypes: current.jobTypes.map((jobType) => ({
                              ...jobType,
                              permissions: jobType.permissions.map((permission) => ({
                                ...permission,
                                enabled: nextMap.get(`${jobType.jobTypeId}:${permission.permissionKey}`) ?? permission.enabled,
                                hasOverride: (nextMap.get(`${jobType.jobTypeId}:${permission.permissionKey}`) ?? permission.enabled) !== permission.inheritedEnabled,
                              })),
                            })),
                          }));
                        }}
                      />
                    )}
                  </div>

                  <div className="permission-policy-note">
                    הרשאות התפקידים נוצרות דינמית לפי היכולות של כל Job Type. הרשאות מערכת רוחביות נשארות בנפרד למטה.
                  </div>

                  <UserPermissionsTab
                    title="הרשאות מערכת"
                    allowedPermissionKeys={SYSTEM_PERMISSION_KEYS}
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