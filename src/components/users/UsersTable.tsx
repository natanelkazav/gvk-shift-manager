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

import type {
  UserProfile,
  UserRole,
} from '../../types/auth';

interface UsersTableProps {
  users:
    UserProfile[];

  isLoading:
    boolean;

  currentUserId:
    string | null;

  updatingUserId:
    string | null;

  deletingUserId:
    string | null;

  resettingPasswordUserId:
    string | null;

  canResetPasswords:
    boolean;

  onEditUser: (
    profile: UserProfile,
  ) => void;

  onDeleteUser: (
    profile: UserProfile,
  ) => void;

  onResetPassword: (
    profile:
      UserProfile,
  ) => Promise<void>;

  onToggleActiveStatus: (
    profile: UserProfile,
  ) => Promise<void>;
}

interface UserRoleDefinition {
  role:
    UserRole;

  label:
    string;

  description:
    string;

  icon:
    typeof Crown;
}

interface UserRoleGroup {
  definition:
    UserRoleDefinition;

  users:
    UserProfile[];

  activeCount:
    number;

  inactiveCount:
    number;
}

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

function formatDate(
  dateValue:
    string | null,
): string {
  if (!dateValue) {
    return 'טרם התחבר';
  }

  const date =
    new Date(
      dateValue,
    );

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

function getInitials(
  profile:
    UserProfile,
): string {
  const normalizedName =
    profile.displayName
      .trim();

  if (!normalizedName) {
    return '?';
  }

  const nameParts =
    normalizedName
      .split(/\s+/)
      .filter(Boolean);

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

function UsersTable({
  users,
  isLoading,
  currentUserId,
  updatingUserId,
  deletingUserId,
  resettingPasswordUserId,
  canResetPasswords,
  onEditUser,
  onDeleteUser,
  onResetPassword,
  onToggleActiveStatus,
}: UsersTableProps) {
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

  const [
    isInactiveCollapsed,
    setIsInactiveCollapsed,
  ] =
    useState(
      true,
    );

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

  const roleGroups =
    useMemo<
      UserRoleGroup[]
    >(
      () =>
        roleDefinitions
          .map(
            (
              definition,
            ) => {
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
        users,
      ],
    );

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

          const isCollapsed =
            Boolean(
              collapsedRoles[
                definition.role
              ],
            );

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
                            const isCurrentUser =
                              profile.id ===
                              currentUserId;

                            const isUpdating =
                              updatingUserId ===
                              profile.id;

                            const isDeleting =
                              deletingUserId ===
                              profile.id;

                            const isResettingPassword =
                              resettingPasswordUserId ===
                              profile.id;

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
                    const isUpdating =
                      updatingUserId ===
                      profile.id;

                    const isDeleting =
                      deletingUserId ===
                      profile.id;

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