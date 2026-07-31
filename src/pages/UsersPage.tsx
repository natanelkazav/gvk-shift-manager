import { RefreshCw } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import EditUserModal from '../components/users/EditUserModal';
import UsersFilters from '../components/users/UsersFilters';
import UsersStatistics from '../components/users/UsersStatistics';
import UsersTable from '../components/users/UsersTable';
import {
  Button,
  PageHeader,
} from '../components/ui';
import { usersService } from '../services/usersService';
import type { UserProfile } from '../types/auth';
import type {
  UpdateUserProfileInput,
  UsersFilters as UsersFiltersState,
  UsersState,
} from '../types/users';
import '../styles/users.css';

const initialUsersState: UsersState = {
  users: [],
  isLoading: true,
  error: null,
};

const initialFilters: UsersFiltersState = {
  searchTerm: '',
  role: 'all',
  status: 'all',
};

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
    useState<UsersFiltersState>(
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

        updateLocalUser(updatedProfile);

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

        updateLocalUser(updatedProfile);
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

      <UsersStatistics
        total={statistics.total}
        active={statistics.active}
        inactive={statistics.inactive}
        admins={statistics.admins}
      />

      <UsersFilters
        filters={filters}
        onChange={setFilters}
      />

      <UsersTable
        users={filteredUsers}
        isLoading={
          usersState.isLoading
        }
        currentUserId={
          authenticatedUser?.id ?? null
        }
        updatingUserId={
          updatingUserId
        }
        onEditUser={openEditModal}
        onToggleActiveStatus={
          handleToggleActiveStatus
        }
      />

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