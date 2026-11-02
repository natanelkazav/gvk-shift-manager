/**
 * קובץ: src/components/users/CreateUserModal.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור משתמש.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: CreateUserModalProps, CreateUserFormState, CreateUserTab, CreateUserModal.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  BriefcaseBusiness,
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
import DynamicUserAssignmentsEditor from './dynamic/DynamicUserAssignmentsEditor';
import {
  arePermissionListsEqual,
  getDefaultPermissionsForRole,
} from '../../config/defaultRolePermissions';
import type {
  PermissionKey,
  UserRole,
} from '../../types/auth';
import type { CreateUserInput } from '../../types/users';
import type { DynamicJobType } from '../../types/dynamicScheduling';
import type { DynamicUserAssignmentSelection } from '../../types/dynamicUserAssignments';
import {
  accountTypeFromLegacyRole,
  legacyRoleForAccountType,
  SYSTEM_ACCOUNT_DESCRIPTIONS,
  SYSTEM_ACCOUNT_LABELS,
  type SystemAccountType,
} from '../../config/systemAccountTypes';

import './EditUserModalTabs.css';


// SYSTEM_PERMISSION_KEYS — מפתחות ההרשאות.
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
  'contacts.view',
  'contacts.edit',
  'contacts.import',
  'contacts.changes_view',
];

/**
 * פעולה getDefaultSystemPermissions: שליפה או חישוב של הרשאות.
 * @param role — הנתון role בהקשר הפעולה.
 * @returns PermissionKey[] — הפלט בהתאם לחתימה.
 */
const getDefaultSystemPermissions = (role: UserRole): PermissionKey[] =>
  getDefaultPermissionsForRole(role).filter((permission) => SYSTEM_PERMISSION_KEYS.includes(permission));

/**
 * חוזה הנתונים CreateUserModalProps: משתמש / מאפייני הרכיב.
 */
interface CreateUserModalProps {
  // dynamicJobTypes — סוגי תפקידים.
  dynamicJobTypes: DynamicJobType[];
  // isOpen — האם המצב פתוח.
  isOpen: boolean;
  // isSaving — האם שמירה מתבצעת.
  isSaving: boolean;

  // onClose — פונקציית סגירת התצוגה.
  onClose: () => void;

  onCreate: (
    input: CreateUserInput,
    permissions: PermissionKey[],
    assignments: DynamicUserAssignmentSelection[],
  ) => Promise<void>;
}

/**
 * חוזה הנתונים CreateUserFormState: משתמש / מצב.
 */
interface CreateUserFormState {
  // email — כתובת דוא״ל.
  email: string;
  // password — סיסמה.
  password: string;
  // confirmPassword — סיסמה.
  confirmPassword: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string;
  role: UserRole;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  // mustChangePassword — סיסמה.
  mustChangePassword: boolean;
}

/**
 * טיפוס CreateUserTab: משתמש.
 */
type CreateUserTab =
  | 'details'
  | 'assignments'
  | 'permissions';

// INITIAL_ROLE — הנתון INITIAL_ROLE בהקשר הפעולה.
const INITIAL_ROLE:
  UserRole = 'dispatcher';

// initialFormState — מצב.
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

/**
 * פעולה CreateUserModal: יצירת משתמש.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function CreateUserModal({
  dynamicJobTypes,
  isOpen,
  isSaving,
  onClose,
  onCreate,
}: CreateUserModalProps) {
  // מצב מקומי: activeTab — פעיל; setActiveTab מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    activeTab,
    setActiveTab,
  ] = useState<CreateUserTab>(
    'details',
  );

  // מצב מקומי: formState — מצב; setFormState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    formState,
    setFormState,
  ] = useState<CreateUserFormState>(
    initialFormState,
  );

  // מצב מקומי: selectedPermissions — נבחר / הרשאות; setSelectedPermissions מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedPermissions,
    setSelectedPermissions,
  ] = useState<PermissionKey[]>(
    () =>
      getDefaultSystemPermissions(INITIAL_ROLE),
  );

  // מצב מקומי: assignments — הקצאות; setAssignments מעדכנת אותו ומפעילה רינדור לפי React.
  const [assignments, setAssignments] = useState<DynamicUserAssignmentSelection[]>([]);

  // מצב מקומי: formError — שגיאה; setFormError מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    formError,
    setFormError,
  ] = useState<string | null>(
    null,
  );

  // מצב מקומי: permissionsNotice — הרשאות; setPermissionsNotice מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    permissionsNotice,
    setPermissionsNotice,
  ] = useState<string | null>(
    null,
  );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [isOpen].
  useEffect(() => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isOpen.
    if (!isOpen) {
      return;
    }

    setFormState({
      ...initialFormState,
    });

    setSelectedPermissions(
      getDefaultSystemPermissions(INITIAL_ROLE),
    );

    setAssignments([]);
    setFormError(null);
    setPermissionsNotice(null);
    setActiveTab('details');
  }, [isOpen]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ isOpen, isSaving, onClose, ].
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

  // ערך מחושב defaultPermissions — הרשאות; נשמר בין רינדורים עד שינוי התלויות.
  const defaultPermissions =
    useMemo(
      () =>
        getDefaultSystemPermissions(formState.role),
      [formState.role],
    );

  // ערך מחושב usesDefaultPermissions — הרשאות; נשמר בין רינדורים עד שינוי התלויות.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isOpen.
  if (!isOpen) {
    return null;
  }

  /**
   * פעולה validateForm: בדיקת תקינות של הנתון validateForm בהקשר הפעולה.
   * @returns string | null — הפלט בהתאם לחתימה.
   */
  const validateForm =
    (): string | null => {
      // normalizedDisplayName — שם תצוגה.
      const normalizedDisplayName =
        formState.displayName.trim();

      // normalizedEmail — כתובת דוא״ל.
      const normalizedEmail =
        formState.email
          .trim()
          .toLowerCase();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedDisplayName.
      if (!normalizedDisplayName) {
        return 'יש להזין שם תצוגה.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedDisplayName.length < 2.
      if (
        normalizedDisplayName.length <
        2
      ) {
        return 'שם התצוגה חייב להכיל לפחות שני תווים.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedEmail.
      if (!normalizedEmail) {
        return 'יש להזין כתובת אימייל.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedEmail.includes('@').
      if (
        !normalizedEmail.includes('@')
      ) {
        return 'כתובת האימייל אינה תקינה.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !formState.password.
      if (!formState.password) {
        return 'יש להזין סיסמה זמנית.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר formState.password.length < 8.
      if (
        formState.password.length < 8
      ) {
        return 'הסיסמה חייבת להכיל לפחות שמונה תווים.';
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר formState.password !== formState.confirmPassword.
      if (
        formState.password !==
        formState.confirmPassword
      ) {
        return 'הסיסמאות אינן תואמות.';
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

      setActiveTab('details');
      return;
    }

    setFormError(null);

    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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
        assignments,
      );
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'לא ניתן היה ליצור את המשתמש.',
      );
    }
  };

  /**
   * פעולה handleAccountTypeChange: טיפול באירוע עבור הנתון handleAccountTypeChange בהקשר הפעולה.
   * @param nextAccountType — הנתון nextAccountType בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleAccountTypeChange = (nextAccountType: SystemAccountType): void => {
    handleRoleChange(legacyRoleForAccountType(nextAccountType, formState.role));
  };

  /**
   * פעולה handleRoleChange: טיפול באירוע עבור הנתון handleRoleChange בהקשר הפעולה.
   * @param nextRole — הנתון nextRole בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleRoleChange = (
    nextRole: UserRole,
  ): void => {
    // nextPermissions — הרשאות.
    const nextPermissions =
      getDefaultSystemPermissions(nextRole);

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
      `הוחלו הרשאות ברירת המחדל של סוג החשבון "${SYSTEM_ACCOUNT_LABELS[accountTypeFromLegacyRole(nextRole)]}". ניתן לערוך אותן לפני יצירת המשתמש.`,
    );
  };

  /**
   * פעולה handleApplyRoleDefaults: טיפול באירוע עבור הנתון handleApplyRoleDefaults בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleApplyRoleDefaults =
    (): void => {
      setSelectedPermissions(
        getDefaultSystemPermissions(formState.role),
      );

      setFormError(null);

      setPermissionsNotice(
        `הרשאות ברירת המחדל של סוג החשבון "${SYSTEM_ACCOUNT_LABELS[accountTypeFromLegacyRole(formState.role)]}" הוחלו מחדש.`,
      );
    };

  /**
   * פעולה handleTabChange: טיפול באירוע עבור הנתון handleTabChange בהקשר הפעולה.
   * @param tab — הנתון tab בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleTabChange = (
    tab: CreateUserTab,
  ): void => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isSaving.
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
            id="create-user-assignments-tab"
            aria-selected={activeTab === 'assignments'}
            aria-controls="create-user-assignments-panel"
            className={[
              'edit-user-tab',
              activeTab === 'assignments' ? 'edit-user-tab-active' : '',
            ].filter(Boolean).join(' ')}
            disabled={isSaving}
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
                  <span>סוג חשבון</span>

                  <select
                    value={accountTypeFromLegacyRole(formState.role)}
                    disabled={isSaving}
                    onChange={(event) => {
                      handleAccountTypeChange(event.target.value as SystemAccountType);
                    }}
                  >
                    {(Object.entries(SYSTEM_ACCOUNT_LABELS) as Array<[SystemAccountType, string]>).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <small>{SYSTEM_ACCOUNT_DESCRIPTIONS[accountTypeFromLegacyRole(formState.role)]}</small>
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
          ) : activeTab === 'assignments' ? (
            <div
              id="create-user-assignments-panel"
              role="tabpanel"
              aria-labelledby="create-user-assignments-tab"
              className="edit-user-tab-panel"
            >
              <DynamicUserAssignmentsEditor
                jobTypes={dynamicJobTypes}
                assignments={assignments}
                isDisabled={isSaving}
                onChange={setAssignments}
              />
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
                  הרשאות מערכת לסוג חשבון: {' '}
                  {SYSTEM_ACCOUNT_LABELS[accountTypeFromLegacyRole(formState.role)]}
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
                title="הרשאות מערכת"
                allowedPermissionKeys={SYSTEM_PERMISSION_KEYS}
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