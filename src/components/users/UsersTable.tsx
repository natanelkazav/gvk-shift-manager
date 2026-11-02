/**
 * קובץ: src/components/users/UsersTable.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור משתמשים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UsersTableProps, UserRoleDefinition, UserRoleGroup, formatDate, getInitials, UsersTable.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Crown,
  Eye,
  Headphones,
  KeyRound,
  Pencil,
  Power,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRoundCog,
  Users,
  Wrench,
} from 'lucide-react';

import {
  useMemo,
  useState,
} from 'react';

import {
  Button,
} from '../ui';
import DynamicJobTypeUserGroups from './DynamicJobTypeUserGroups';

import type {
  UserProfile,
  UserRole,
} from '../../types/auth';
import type { DynamicJobType } from '../../types/dynamicScheduling';

/**
 * חוזה הנתונים UsersTableProps: משתמשים / מאפייני הרכיב.
 */
interface UsersTableProps {
  // users — משתמשים.
  users:
    UserProfile[];

  // isLoading — האם טעינה מתבצעת.
  isLoading:
    boolean;

  // currentUserId — המשתמש הנוכחי הנוכחי.
  currentUserId:
    string | null;

  // updatingUserId — מזהה משתמש.
  updatingUserId:
    string | null;

  // deletingUserId — מזהה משתמש.
  deletingUserId:
    string | null;

  // resettingPasswordUserId — מזהה משתמש.
  resettingPasswordUserId:
    string | null;

  canResetPasswords:
    boolean;

  // dynamicJobTypes — סוגי תפקידים.
  dynamicJobTypes:
    DynamicJobType[];

  // dynamicFirstEnabled — דינמי / האם האפשרות מופעלת.
  dynamicFirstEnabled:
    boolean;

  // onEditUser — משתמש.
  onEditUser: (
    profile: UserProfile,
  ) => void;

  // onDeleteUser — משתמש.
  onDeleteUser: (
    profile: UserProfile,
  ) => void;

  // onResetPassword — סיסמה.
  onResetPassword: (
    profile:
      UserProfile,
  ) => Promise<void>;

  // onToggleActiveStatus — פעיל / סטטוס.
  onToggleActiveStatus: (
    profile: UserProfile,
  ) => Promise<void>;
}

/**
 * חוזה הנתונים UserRoleDefinition: משתמש.
 */
interface UserRoleDefinition {
  role:
    UserRole;

  // label — תווית.
  label:
    string;

  description:
    string;

  icon:
    typeof Crown;
}

/**
 * חוזה הנתונים UserRoleGroup: משתמש / קבוצה.
 */
interface UserRoleGroup {
  definition:
    UserRoleDefinition;

  // users — משתמשים.
  users:
    UserProfile[];

  // activeCount — פעיל / כמות.
  activeCount:
    number;

  // inactiveCount — כמות.
  inactiveCount:
    number;
}

// roleDefinitions — הנתון roleDefinitions בהקשר הפעולה.
const roleDefinitions:
  readonly UserRoleDefinition[] = [
    {
      role:
        'admin',

      label:
        'מנהלי מערכת',

      description:
        'גישה מלאה לניהול המערכת וההרשאות',

      icon:
        Crown,
    },

    {
      role:
        'manager',

      label:
        'מנהלים',

      description:
        'ניהול צוות, נתונים ותהליכים מרכזיים',

      icon:
        UserRoundCog,
    },

    {
      role:
        'dispatcher',

      label:
        'מוקדנים',

      description:
        'עבודה שוטפת, אילוצים ושיבוץ משמרות',

      icon:
        Headphones,
    },

    {
      role:
        'on_call',

      label:
        'כוננים',

      description:
        'אילוצי זמינות, לוח כוננים והחלפות',

      icon:
        Wrench,
    },

    {
      role:
        'morning_driver',

      label:
        'כונני בוקר',

      description:
        'אילוצים ושיבוץ למשמרות כונני הבוקר',

      icon:
        Wrench,
    },

    {
      role:
        'viewer',

      label:
        'צפייה בלבד',

      description:
        'גישה לצפייה ללא הרשאות ניהול',

      icon:
        Eye,
    },
  ];

// roleLabels — הנתון roleLabels בהקשר הפעולה.
const roleLabels:
  Record<UserRole, string> = {
    admin:
      'מנהל מערכת',

    manager:
      'מנהלת',

    dispatcher:
      'מוקדן',

    on_call:
      'כונן',

    morning_driver:
      'כונן בוקר',

    viewer:
      'צפייה בלבד',
  };

/**
 * פעולה formatDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param dateValue — תאריך / ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDate(
  dateValue:
    string | null,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !dateValue.
  if (!dateValue) {
    return 'טרם התחבר';
  }

  // date — תאריך.
  const date =
    new Date(
      dateValue,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר Number.isNaN( date.getTime(), ).
  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'לא ידוע';
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle:
        'short',

      timeStyle:
        'short',
    },
  ).format(
    date,
  );
}

/**
 * פעולה getInitials: שליפה או חישוב של הנתון getInitials בהקשר הפעולה.
 * @param profile — פרופיל.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getInitials(
  profile:
    UserProfile,
): string {
  // normalizedName — שם.
  const normalizedName =
    profile.displayName
      .trim();

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedName.
  if (!normalizedName) {
    return '?';
  }

  // nameParts — שם.
  const nameParts =
    normalizedName
      .split(/\s+/)
      .filter(Boolean);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר nameParts.length === 1.
  if (
    nameParts.length === 1
  ) {
    return (
      nameParts[0]
        ?.charAt(0)
        .toUpperCase() ||
      '?'
    );
  }

  return [
    nameParts[0]
      ?.charAt(0),

    nameParts[
      nameParts.length - 1
    ]?.charAt(0),
  ]
    .filter(Boolean)
    .join('')
    .toUpperCase();
}

/**
 * פעולה UsersTable: משתמשים.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function UsersTable({
  users,
  isLoading,
  currentUserId,
  updatingUserId,
  deletingUserId,
  resettingPasswordUserId,
  canResetPasswords,
  dynamicJobTypes,
  dynamicFirstEnabled,
  onEditUser,
  onDeleteUser,
  onResetPassword,
  onToggleActiveStatus,
}: UsersTableProps) {
// מצב מקומי: collapsedRoles — הנתון collapsedRoles בהקשר הפעולה; setCollapsedRoles מעדכנת אותו ומפעילה רינדור לפי React.
const [
  collapsedRoles,
  setCollapsedRoles,
] =
  useState<
    Record<
      UserRole,
      boolean
    >
  >({
    admin: true,
    manager: true,
    dispatcher: true,
    on_call: true,
    morning_driver: true,
    viewer: true,
  });

  // מצב מקומי: isInactiveCollapsed — הנתון isInactiveCollapsed בהקשר הפעולה; setIsInactiveCollapsed מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isInactiveCollapsed,
    setIsInactiveCollapsed,
  ] =
    useState(
      true,
    );

  // ערך מחושב inactiveUsers — משתמשים; נשמר בין רינדורים עד שינוי התלויות.
  const inactiveUsers =
    useMemo(
      () =>
        users.filter(
          (
            profile,
          ) =>
            !profile.isActive,
        ),
      [
        users,
      ],
    );

  // ערך מחושב roleGroups — קבוצות; נשמר בין רינדורים עד שינוי התלויות.
  const roleGroups =
    useMemo<
      UserRoleGroup[]
    >(
      () =>
        roleDefinitions
          .filter((definition) =>
            !dynamicFirstEnabled ||
            !(['dispatcher', 'on_call', 'morning_driver'] as UserRole[]).includes(definition.role),
          )
          .map(
            (
              definition,
            ) => {
              // roleUsers — משתמשים.
              const roleUsers =
                users.filter(
                  (
                    profile,
                  ) =>
                    profile.role ===
                      definition.role &&
                    profile.isActive,
                );

              return {
                definition,

                users:
                  roleUsers,

                activeCount:
                  roleUsers.filter(
                    (
                      profile,
                    ) =>
                      profile.isActive,
                  ).length,

                inactiveCount:
                  roleUsers.filter(
                    (
                      profile,
                    ) =>
                      !profile.isActive,
                  ).length,
              };
            },
          )
          .filter(
            (
              group,
            ) =>
              group.users.length >
              0,
          ),
      [
        dynamicFirstEnabled,
        users,
      ],
    );

  /**
   * פעולה toggleRole: החלפת בחירה עבור הנתון toggleRole בהקשר הפעולה.
   * @param role — הנתון role בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const toggleRole =
    (
      role:
        UserRole,
    ): void => {
      setCollapsedRoles(
        (
          currentState,
        ) => ({
          ...currentState,

          [role]:
            !currentState[
              role
            ],
        }),
      );
    };

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isLoading.
  if (isLoading) {
    return (
      <div className="users-table-container">
        <div className="users-empty-state">
          <RefreshCw
            className="users-loading-icon"
            size={28}
            aria-hidden="true"
          />

          <p>
            טוען את רשימת
            המשתמשים...
          </p>
        </div>
      </div>
    );
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר users.length === 0.
  if (
    users.length === 0
  ) {
    return (
      <div className="users-table-container">
        <div className="users-empty-state">
          <Users
            size={32}
            aria-hidden="true"
          />

          <p>
            לא נמצאו משתמשים
            המתאימים לסינון.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="users-role-groups">
      <DynamicJobTypeUserGroups
        users={users}
        jobTypes={dynamicJobTypes}
        currentUserId={currentUserId}
        updatingUserId={updatingUserId}
        deletingUserId={deletingUserId}
        resettingPasswordUserId={resettingPasswordUserId}
        canResetPasswords={canResetPasswords}
        onEditUser={onEditUser}
        onDeleteUser={onDeleteUser}
        onResetPassword={onResetPassword}
        onToggleActiveStatus={onToggleActiveStatus}
      />

      {roleGroups.map(
        (
          group,
        ) => {
          const {
            definition,
          } =
            group;

          const Icon =
            definition.icon;

          // isCollapsed — הנתון isCollapsed בהקשר הפעולה.
          const isCollapsed =
            Boolean(
              collapsedRoles[
                definition.role
              ],
            );

          // contentId — מזהה.
          const contentId =
            `users-role-${definition.role}`;

          return (
            <section
              key={
                definition.role
              }
              className={[
                'users-role-group',

                isCollapsed
                  ? 'users-role-group-collapsed'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <button
                type="button"
                className="users-role-group-header"
                aria-expanded={
                  !isCollapsed
                }
                aria-controls={
                  contentId
                }
                onClick={() => {
                  toggleRole(
                    definition.role,
                  );
                }}
              >
                <span className="users-role-group-icon">
                  <Icon
                    size={22}
                    aria-hidden="true"
                  />
                </span>

                <span className="users-role-group-heading">
                  <span className="users-role-group-title-row">
                    <strong>
                      {
                        definition.label
                      }
                    </strong>

                    <span className="users-role-group-count">
                      {
                        group
                          .users
                          .length
                      }
                    </span>
                  </span>

                  <small>
                    {
                      definition
                        .description
                    }
                  </small>
                </span>

                <span className="users-role-group-summary">
                  <span className="users-role-group-active-count">
                    {
                      group
                        .activeCount
                    }{' '}
                    פעילים
                  </span>

                  {group
                    .inactiveCount >
                  0 ? (
                    <span className="users-role-group-inactive-count">
                      {
                        group
                          .inactiveCount
                      }{' '}
                      מושבתים
                    </span>
                  ) : null}
                </span>

                <span className="users-role-group-toggle">
                  {isCollapsed ? (
                    <ChevronLeft
                      size={20}
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDown
                      size={20}
                      aria-hidden="true"
                    />
                  )}
                </span>
              </button>

              {!isCollapsed ? (
                <div
                  id={
                    contentId
                  }
                  className="users-role-group-content"
                >
                  <div className="users-group-table-wrapper">
                    <table className="users-table users-group-table">
                      <thead>
                        <tr>
                          <th>
                            משתמש
                          </th>

                          <th>
                            שם שיבוץ
                          </th>

                          <th>
                            תפקיד
                          </th>

                          <th>
                            סטטוס
                          </th>

                          <th>
                            התחברות אחרונה
                          </th>

                          <th>
                            פעולות
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {group.users.map(
                          (
                            profile,
                          ) => {
                            // isCurrentUser — המשתמש הנוכחי.
                            const isCurrentUser =
                              profile.id ===
                              currentUserId;

                            // isUpdating — הנתון isUpdating בהקשר הפעולה.
                            const isUpdating =
                              updatingUserId ===
                              profile.id;

                            // isDeleting — הנתון isDeleting בהקשר הפעולה.
                            const isDeleting =
                              deletingUserId ===
                              profile.id;

                            // isResettingPassword — סיסמה.
                            const isResettingPassword =
                              resettingPasswordUserId ===
                              profile.id;

                            // isBusy — הנתון isBusy בהקשר הפעולה.
                            const isBusy =
                              isUpdating ||
                              isDeleting ||
                              isResettingPassword;

                            return (
                              <tr
                                key={
                                  profile.id
                                }
                                className={[
                                  isCurrentUser
                                    ? 'users-row-current'
                                    : '',

                                  !profile
                                    .isActive
                                    ? 'users-row-inactive'
                                    : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                <td>
                                  <div className="users-user-cell">
                                    <div className="users-avatar">
                                      {getInitials(
                                        profile,
                                      )}
                                    </div>

                                    <div className="users-user-details">
                                      <div className="users-user-name-row">
                                        <strong>
                                          {
                                            profile
                                              .displayName
                                          }
                                        </strong>

                                        {isCurrentUser ? (
                                          <span className="users-current-user-badge">
                                            אתה
                                          </span>
                                        ) : null}
                                      </div>

                                      <span>
                                        {
                                          profile
                                            .email
                                        }
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                <td>
                                  <span className="users-schedule-name">
                                    {profile
                                      .scheduleName ??
                                      'לא הוגדר'}
                                  </span>
                                </td>

                                <td>
                                  <span
                                    className={[
                                      'users-role-badge',

                                      `users-role-badge-${profile.role}`,
                                    ].join(' ')}
                                  >
                                    {
                                      roleLabels[
                                        profile.role
                                      ]
                                    }
                                  </span>
                                </td>

                                <td>
                                  <span
                                    className={
                                      profile.isActive
                                        ? 'users-status users-status-active'
                                        : 'users-status users-status-inactive'
                                    }
                                  >
                                    {profile.isActive ? (
                                      <CheckCircle2
                                        size={15}
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Power
                                        size={15}
                                        aria-hidden="true"
                                      />
                                    )}

                                    {profile.isActive
                                      ? 'פעיל'
                                      : 'מושבת'}
                                  </span>
                                </td>

                                <td>
                                  <span className="users-last-login">
                                    {formatDate(
                                      profile
                                        .lastLoginAt,
                                    )}
                                  </span>
                                </td>

                                <td>
                                  <div className="users-actions users-icon-actions">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      disabled={
                                        isBusy
                                      }
                                      title={`עריכת ${profile.displayName}`}
                                      aria-label={`עריכת ${profile.displayName}`}
                                      onClick={() => {
                                        onEditUser(
                                          profile,
                                        );
                                      }}
                                    >
                                      <Pencil
                                        size={16}
                                        aria-hidden="true"
                                      />
                                    </Button>


                                    {canResetPasswords ? (
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={
                                          isBusy
                                        }
                                        title={`איפוס הסיסמה של ${profile.displayName}`}
                                        aria-label={`איפוס הסיסמה של ${profile.displayName}`}
                                        onClick={() => {
                                          void onResetPassword(
                                            profile,
                                          );
                                        }}
                                      >
                                        {isResettingPassword ? (
                                          <RefreshCw
                                            size={16}
                                            className="users-action-loading-icon"
                                            aria-hidden="true"
                                          />
                                        ) : (
                                          <KeyRound
                                            size={16}
                                            aria-hidden="true"
                                          />
                                        )}
                                      </Button>
                                    ) : null}

                                    <Button
                                      type="button"
                                      variant={
                                        profile.isActive
                                          ? 'danger'
                                          : 'secondary'
                                      }
                                      disabled={
                                        isCurrentUser ||
                                        isBusy
                                      }
                                      title={
                                        isCurrentUser
                                          ? 'לא ניתן להשבית את המשתמש הנוכחי'
                                          : profile.isActive
                                            ? `השבתת ${profile.displayName}`
                                            : `הפעלת ${profile.displayName}`
                                      }
                                      aria-label={
                                        profile.isActive
                                          ? `השבתת ${profile.displayName}`
                                          : `הפעלת ${profile.displayName}`
                                      }
                                      onClick={() => {
                                        void onToggleActiveStatus(
                                          profile,
                                        );
                                      }}
                                    >
                                      {isUpdating ? (
                                        <RefreshCw
                                          size={16}
                                          className="users-action-loading-icon"
                                          aria-hidden="true"
                                        />
                                      ) : profile.isActive ? (
                                        <Power
                                          size={16}
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <CheckCircle2
                                          size={16}
                                          aria-hidden="true"
                                        />
                                      )}
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="danger"
                                      disabled={
                                        isCurrentUser ||
                                        isBusy
                                      }
                                      title={
                                        isCurrentUser
                                          ? 'לא ניתן למחוק את המשתמש הנוכחי'
                                          : `מחיקת ${profile.displayName}`
                                      }
                                      aria-label={`מחיקת ${profile.displayName}`}
                                      onClick={() => {
                                        onDeleteUser(
                                          profile,
                                        );
                                      }}
                                    >
                                      {isDeleting ? (
                                        <RefreshCw
                                          size={16}
                                          className="users-action-loading-icon"
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <Trash2
                                          size={16}
                                          aria-hidden="true"
                                        />
                                      )}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </section>
          );
        },
      )}

      {inactiveUsers.length > 0 ? (
        <section
          className={[
            'users-role-group',
            'users-inactive-group',
            isInactiveCollapsed
              ? 'users-role-group-collapsed'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <button
            type="button"
            className="users-role-group-header users-inactive-group-header"
            aria-expanded={
              !isInactiveCollapsed
            }
            aria-controls="users-inactive-content"
            onClick={() => {
              setIsInactiveCollapsed(
                (
                  currentValue,
                ) =>
                  !currentValue,
              );
            }}
          >
            <span className="users-role-group-icon users-inactive-group-icon">
              <Power
                size={22}
                aria-hidden="true"
              />
            </span>

            <span className="users-role-group-heading">
              <span className="users-role-group-title-row">
                <strong>
                  משתמשים מושבתים
                </strong>

                <span className="users-role-group-count users-inactive-group-count">
                  {inactiveUsers.length}
                </span>
              </span>

              <small>
                משתמשים שאינם יכולים להתחבר למערכת. ניתן להפעיל אותם מחדש בכל עת.
              </small>
            </span>

            <span className="users-role-group-summary">
              <span className="users-role-group-inactive-count">
                {inactiveUsers.length}{' '}
                מושבתים
              </span>
            </span>

            <span className="users-role-group-toggle">
              {isInactiveCollapsed ? (
                <ChevronLeft
                  size={20}
                  aria-hidden="true"
                />
              ) : (
                <ChevronDown
                  size={20}
                  aria-hidden="true"
                />
              )}
            </span>
          </button>

          {!isInactiveCollapsed ? (
            <div
              id="users-inactive-content"
              className="users-role-group-content users-inactive-content"
            >
              <div className="users-inactive-list">
                {inactiveUsers.map(
                  (
                    profile,
                  ) => {
                    // isUpdating — הנתון isUpdating בהקשר הפעולה.
                    const isUpdating =
                      updatingUserId ===
                      profile.id;

                    // isDeleting — הנתון isDeleting בהקשר הפעולה.
                    const isDeleting =
                      deletingUserId ===
                      profile.id;

                    // isBusy — הנתון isBusy בהקשר הפעולה.
                    const isBusy =
                      isUpdating ||
                      isDeleting;

                    return (
                      <article
                        key={
                          profile.id
                        }
                        className="users-inactive-card"
                      >
                        <div className="users-inactive-card-main">
                          <div className="users-avatar users-avatar-inactive">
                            {getInitials(
                              profile,
                            )}
                          </div>

                          <div className="users-inactive-card-details">
                            <strong>
                              {profile.displayName}
                            </strong>
                            <span>
                              {profile.email}
                            </span>
                            <div className="users-inactive-card-meta">
                              <span
                                className={[
                                  'users-role-badge',
                                  `users-role-badge-${profile.role}`,
                                ].join(' ')}
                              >
                                {roleLabels[
                                  profile.role
                                ]}
                              </span>

                              <span className="users-status users-status-inactive">
                                <Power
                                  size={14}
                                  aria-hidden="true"
                                />
                                מושבת
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="users-inactive-card-actions">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={
                              isBusy
                            }
                            onClick={() => {
                              onEditUser(
                                profile,
                              );
                            }}
                          >
                            <Pencil
                              size={16}
                              aria-hidden="true"
                            />
                            עריכה
                          </Button>

                          <Button
                            type="button"
                            disabled={
                              isBusy
                            }
                            onClick={() => {
                              void onToggleActiveStatus(
                                profile,
                              );
                            }}
                          >
                            {isUpdating ? (
                              <RefreshCw
                                size={16}
                                className="users-action-loading-icon"
                                aria-hidden="true"
                              />
                            ) : (
                              <CheckCircle2
                                size={16}
                                aria-hidden="true"
                              />
                            )}
                            הפעלה מחדש
                          </Button>

                          <Button
                            type="button"
                            variant="danger"
                            disabled={
                              isBusy
                            }
                            onClick={() => {
                              onDeleteUser(
                                profile,
                              );
                            }}
                          >
                            {isDeleting ? (
                              <RefreshCw
                                size={16}
                                className="users-action-loading-icon"
                                aria-hidden="true"
                              />
                            ) : (
                              <Trash2
                                size={16}
                                aria-hidden="true"
                              />
                            )}
                            מחיקה
                          </Button>
                        </div>
                      </article>
                    );
                  },
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="users-role-groups-footer">
        <ShieldCheck
          size={18}
          aria-hidden="true"
        />

        <span>
          מוצגים{' '}
          <strong>
            {
              users.length
            }
          </strong>{' '}
          משתמשים. פעילים מוצגים לפי תפקיד, ומושבתים מרוכזים בכרטיס נפרד.
        </span>
      </div>
    </div>
  );
}

export default UsersTable;