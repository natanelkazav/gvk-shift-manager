import {
  CheckCircle2,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  Users,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import EditUserModal from '../components/users/EditUserModal';
import {
  Button,
  Input,
  PageHeader,
} from '../components/ui';
import { usersService } from '../services/usersService';
import type {
  UserProfile,
  UserRole,
} from '../types/auth';
import type {
  UpdateUserProfileInput,
  UsersFilters,
  UsersState,
} from '../types/users';
import '../styles/users.css';

const initialUsersState: UsersState = {
  users: [],
  isLoading: true,
  error: null,
};

const initialFilters: UsersFilters = {
  searchTerm: '',
  role: 'all',
  status: 'all',
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

function formatDate(
  dateValue: string | null,
): string {
  if (!dateValue) {
    return 'טרם התחבר';
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'לא ידוע';
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

function UsersPage() {
  const {
    user: authenticatedUser,
    profile: authenticatedProfile,
    refreshProfile,
  } = useAuth();

  const [usersState, setUsersState] =
    useState<UsersState>(
      initialUsersState,
    );

  const [filters, setFilters] =
    useState<UsersFilters>(
      initialFilters,
    );

  const [
    updatingUserId,
    setUpdatingUserId,
  ] = useState<string | null>(null);

  const [
    selectedUser,
    setSelectedUser,
  ] = useState<UserProfile | null>(
    null,
  );

  const [
    isEditModalOpen,
    setIsEditModalOpen,
  ] = useState(false);

  const loadUsers =
    useCallback(async (): Promise<void> => {
      setUsersState(
        (currentState) => ({
          ...currentState,
          isLoading: true,
          error: null,
        }),
      );

      try {
        const users =
          await usersService.getUsers();

        setUsersState({
          users,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setUsersState(
          (currentState) => ({
            ...currentState,
            isLoading: false,
            error:
              error instanceof Error
                ? error.message
                : 'אירעה שגיאה בטעינת המשתמשים.',
          }),
        );
      }
    }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers =
    useMemo(() => {
      const normalizedSearchTerm =
        filters.searchTerm
          .trim()
          .toLowerCase();

      return usersState.users.filter(
        (profile) => {
          const matchesSearch =
            !normalizedSearchTerm ||
            profile.displayName
              .toLowerCase()
              .includes(
                normalizedSearchTerm,
              ) ||
            profile.email
              .toLowerCase()
              .includes(
                normalizedSearchTerm,
              ) ||
            (
              profile.scheduleName ?? ''
            )
              .toLowerCase()
              .includes(
                normalizedSearchTerm,
              );

          const matchesRole =
            filters.role === 'all' ||
            profile.role === filters.role;

          const matchesStatus =
            filters.status === 'all' ||
            (
              filters.status ===
                'active' &&
              profile.isActive
            ) ||
            (
              filters.status ===
                'inactive' &&
              !profile.isActive
            );

          return (
            matchesSearch &&
            matchesRole &&
            matchesStatus
          );
        },
      );
    }, [
      filters,
      usersState.users,
    ]);

  const statistics = useMemo(() => {
    const activeUsers =
      usersState.users.filter(
        (profile) => profile.isActive,
      ).length;

    const inactiveUsers =
      usersState.users.length -
      activeUsers;

    const adminUsers =
      usersState.users.filter(
        (profile) =>
          profile.role === 'admin',
      ).length;

    return {
      total:
        usersState.users.length,

      active:
        activeUsers,

      inactive:
        inactiveUsers,

      admins:
        adminUsers,
    };
  }, [usersState.users]);

  const openEditModal = (
    profile: UserProfile,
  ): void => {
    setSelectedUser(profile);
    setIsEditModalOpen(true);

    setUsersState(
      (currentState) => ({
        ...currentState,
        error: null,
      }),
    );
  };

  const closeEditModal =
    (): void => {
      if (updatingUserId) {
        return;
      }

      setIsEditModalOpen(false);
      setSelectedUser(null);
    };

  const updateLocalUser = (
    updatedProfile: UserProfile,
  ): void => {
    setUsersState(
      (currentState) => ({
        ...currentState,
        users:
          currentState.users.map(
            (existingProfile) =>
              existingProfile.id ===
              updatedProfile.id
                ? updatedProfile
                : existingProfile,
          ),
        error: null,
      }),
    );
  };

  const handleSaveUser =
    async (
      userId: string,
      input: UpdateUserProfileInput,
    ): Promise<void> => {
      setUpdatingUserId(userId);

      setUsersState(
        (currentState) => ({
          ...currentState,
          error: null,
        }),
      );

      try {
        if (
          userId ===
            authenticatedUser?.id &&
          input.isActive === false
        ) {
          throw new Error(
            'לא ניתן להשבית את המשתמש המחובר כעת.',
          );
        }

        const updatedProfile =
          await usersService.updateUser(
            userId,
            input,
          );

        updateLocalUser(
          updatedProfile,
        );

        if (
          updatedProfile.id ===
          authenticatedUser?.id
        ) {
          await refreshProfile();
        }

        setIsEditModalOpen(false);
        setSelectedUser(null);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'לא ניתן היה לעדכן את המשתמש.';

        setUsersState(
          (currentState) => ({
            ...currentState,
            error: errorMessage,
          }),
        );

        throw error;
      } finally {
        setUpdatingUserId(null);
      }
    };

  const handleToggleActiveStatus =
    async (
      profile: UserProfile,
    ): Promise<void> => {
      if (
        profile.id ===
        authenticatedUser?.id
      ) {
        setUsersState(
          (currentState) => ({
            ...currentState,
            error:
              'לא ניתן להשבית את המשתמש המחובר כעת.',
          }),
        );

        return;
      }

      const actionLabel =
        profile.isActive
          ? 'להשבית'
          : 'להפעיל';

      const confirmed =
        window.confirm(
          `האם אתה בטוח שברצונך ${actionLabel} את המשתמש ${profile.displayName}?`,
        );

      if (!confirmed) {
        return;
      }

      setUpdatingUserId(profile.id);

      setUsersState(
        (currentState) => ({
          ...currentState,
          error: null,
        }),
      );

      try {
        const updatedProfile =
          await usersService
            .setUserActiveStatus(
              profile.id,
              !profile.isActive,
            );

        updateLocalUser(
          updatedProfile,
        );
      } catch (error) {
        setUsersState(
          (currentState) => ({
            ...currentState,
            error:
              error instanceof Error
                ? error.message
                : 'לא ניתן היה לעדכן את המשתמש.',
          }),
        );
      } finally {
        setUpdatingUserId(null);
      }
    };

  return (
    <section className="users-page">
      <PageHeader
        title="ניהול משתמשים"
        description="ניהול משתמשים, תפקידים והרשאות במערכת."
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void loadUsers();
            }}
            disabled={
              usersState.isLoading
            }
          >
            <RefreshCw
              size={18}
              aria-hidden="true"
            />

            רענון
          </Button>
        }
      />

      {authenticatedProfile?.role !==
      'admin' ? (
        <div
          className="users-error"
          role="alert"
        >
          מסך זה מיועד למנהלי מערכת
          בלבד.
        </div>
      ) : null}

      {usersState.error ? (
        <div
          className="users-error"
          role="alert"
        >
          {usersState.error}
        </div>
      ) : null}

      <div className="users-statistics">
        <article className="users-stat-card">
          <Users
            size={22}
            aria-hidden="true"
          />

          <div>
            <span>
              סה״כ משתמשים
            </span>

            <strong>
              {statistics.total}
            </strong>
          </div>
        </article>

        <article className="users-stat-card">
          <UserRoundCheck
            size={22}
            aria-hidden="true"
          />

          <div>
            <span>
              משתמשים פעילים
            </span>

            <strong>
              {statistics.active}
            </strong>
          </div>
        </article>

        <article className="users-stat-card">
          <UserRoundX
            size={22}
            aria-hidden="true"
          />

          <div>
            <span>
              משתמשים מושבתים
            </span>

            <strong>
              {statistics.inactive}
            </strong>
          </div>
        </article>

        <article className="users-stat-card">
          <ShieldCheck
            size={22}
            aria-hidden="true"
          />

          <div>
            <span>
              מנהלי מערכת
            </span>

            <strong>
              {statistics.admins}
            </strong>
          </div>
        </article>
      </div>

      <div className="users-filters">
        <Input
          id="users-search"
          label="חיפוש"
          type="search"
          value={filters.searchTerm}
          placeholder="שם, אימייל או שם שיבוץ"
          startIcon={
            <Search size={18} />
          }
          onChange={(event) => {
            setFilters(
              (currentFilters) => ({
                ...currentFilters,
                searchTerm:
                  event.target.value,
              }),
            );
          }}
        />

        <label className="users-filter-field">
          <span>תפקיד</span>

          <select
            value={filters.role}
            onChange={(event) => {
              setFilters(
                (currentFilters) => ({
                  ...currentFilters,
                  role:
                    event.target
                      .value as
                      | UserRole
                      | 'all',
                }),
              );
            }}
          >
            <option value="all">
              כל התפקידים
            </option>

            <option value="admin">
              מנהל מערכת
            </option>

            <option value="manager">
              מנהלת
            </option>

            <option value="dispatcher">
              מוקדן
            </option>

            <option value="on_call">
              כונן
            </option>

            <option value="viewer">
              צפייה בלבד
            </option>
          </select>
        </label>

        <label className="users-filter-field">
          <span>סטטוס</span>

          <select
            value={filters.status}
            onChange={(event) => {
              setFilters(
                (currentFilters) => ({
                  ...currentFilters,
                  status:
                    event.target
                      .value as
                      UsersFilters['status'],
                }),
              );
            }}
          >
            <option value="all">
              כל המשתמשים
            </option>

            <option value="active">
              פעילים
            </option>

            <option value="inactive">
              מושבתים
            </option>
          </select>
        </label>
      </div>

      <div className="users-table-container">
        {usersState.isLoading ? (
          <div className="users-empty-state">
            <RefreshCw
              className="users-loading-icon"
              size={28}
              aria-hidden="true"
            />

            <p>
              טוען את רשימת המשתמשים...
            </p>
          </div>
        ) : filteredUsers.length ===
          0 ? (
          <div className="users-empty-state">
            <Users
              size={32}
              aria-hidden="true"
            />

            <p>
              לא נמצאו משתמשים המתאימים
              לסינון.
            </p>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>משתמש</th>
                <th>שם שיבוץ</th>
                <th>תפקיד</th>
                <th>סטטוס</th>
                <th>התחברות אחרונה</th>
                <th>פעולות</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map(
                (profile) => {
                  const isCurrentUser =
                    profile.id ===
                    authenticatedUser?.id;

                  const isUpdating =
                    updatingUserId ===
                    profile.id;

                  return (
                    <tr key={profile.id}>
                      <td>
                        <div className="users-user-cell">
                          <div className="users-avatar">
                            {profile.displayName
                              .trim()
                              .charAt(0)
                              .toUpperCase() ||
                              '?'}
                          </div>

                          <div>
                            <strong>
                              {
                                profile.displayName
                              }
                            </strong>

                            <span>
                              {profile.email}
                            </span>

                            {isCurrentUser ? (
                              <small>
                                המשתמש הנוכחי
                              </small>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td>
                        {profile.scheduleName ??
                          'לא הוגדר'}
                      </td>

                      <td>
                        <span className="users-role-badge">
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
                          <CheckCircle2
                            size={15}
                            aria-hidden="true"
                          />

                          {profile.isActive
                            ? 'פעיל'
                            : 'מושבת'}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          profile.lastLoginAt,
                        )}
                      </td>

                      <td>
                        <div className="users-actions">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isUpdating}
                            onClick={() => {
                              openEditModal(
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
                            variant={
                              profile.isActive
                                ? 'danger'
                                : 'secondary'
                            }
                            disabled={
                              isCurrentUser ||
                              isUpdating
                            }
                            onClick={() => {
                              void handleToggleActiveStatus(
                                profile,
                              );
                            }}
                          >
                            {isUpdating
                              ? 'מעדכן...'
                              : profile.isActive
                                ? 'השבת'
                                : 'הפעל'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        )}
      </div>

      <EditUserModal
        user={selectedUser}
        isOpen={isEditModalOpen}
        isSaving={Boolean(
          selectedUser &&
            updatingUserId ===
              selectedUser.id,
        )}
        currentUserId={
          authenticatedUser?.id ?? null
        }
        onClose={closeEditModal}
        onSave={handleSaveUser}
      />
    </section>
  );
}

export default UsersPage;