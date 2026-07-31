import {
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import {
  useState,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import CreateUserModal from '../components/users/CreateUserModal';
import EditUserModal from '../components/users/EditUserModal';
import UsersFilters from '../components/users/UsersFilters';
import UsersStatistics from '../components/users/UsersStatistics';
import UsersTable from '../components/users/UsersTable';
import {
  Button,
  PageHeader,
} from '../components/ui';
import { useUsers } from '../hooks/useUsers';
import type {
  UserProfile,
} from '../types/auth';
import type {
  CreateUserInput,
  UpdateUserProfileInput,
  UsersFilters as UsersFiltersState,
} from '../types/users';
import '../styles/users.css';

const initialFilters:
  UsersFiltersState = {
    searchTerm: '',
    role: 'all',
    status: 'all',
  };

function UsersPage() {
  const {
    user: authenticatedUser,
    refreshProfile,
    hasPermission,
  } = useAuth();

  const canManageUsers =
    hasPermission(
      'users.manage',
    );

  const [filters, setFilters] =
    useState<UsersFiltersState>(
      initialFilters,
    );

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

  const [
    isCreateModalOpen,
    setIsCreateModalOpen,
  ] = useState(false);

  const {
    usersState,
    filteredUsers,
    statistics,
    updatingUserId,
    isCreatingUser,
    loadUsers,
    createUser,
    updateUser,
    toggleActiveStatus,
    clearError,
  } = useUsers({
    authenticatedUserId:
      authenticatedUser?.id ??
      null,

    refreshAuthenticatedProfile:
      refreshProfile,

    filters,
  });

  const openCreateModal =
    (): void => {
      if (!canManageUsers) {
        return;
      }

      clearError();
      setIsCreateModalOpen(true);
    };

  const closeCreateModal =
    (): void => {
      if (isCreatingUser) {
        return;
      }

      setIsCreateModalOpen(false);
    };

  const openEditModal = (
    profile: UserProfile,
  ): void => {
    if (!canManageUsers) {
      return;
    }

    clearError();
    setSelectedUser(profile);
    setIsEditModalOpen(true);
  };

  const closeEditModal =
    (): void => {
      if (updatingUserId) {
        return;
      }

      setIsEditModalOpen(false);
      setSelectedUser(null);
    };

  const handleCreateUser =
    async (
      input: CreateUserInput,
    ): Promise<void> => {
      if (!canManageUsers) {
        throw new Error(
          'אין לך הרשאה ליצור משתמשים.',
        );
      }

      await createUser(input);

      setIsCreateModalOpen(false);
    };

  const handleSaveUser =
    async (
      userId: string,
      input:
        UpdateUserProfileInput,
    ): Promise<void> => {
      if (!canManageUsers) {
        throw new Error(
          'אין לך הרשאה לערוך משתמשים.',
        );
      }

      await updateUser(
        userId,
        input,
      );

      setIsEditModalOpen(false);
      setSelectedUser(null);
    };

  const handleToggleActiveStatus =
    async (
      profile: UserProfile,
    ): Promise<void> => {
      if (!canManageUsers) {
        return;
      }

      await toggleActiveStatus(
        profile,
      );
    };

  return (
    <section className="users-page">
      <PageHeader
        title="ניהול משתמשים"
        description="ניהול משתמשים, תפקידים והרשאות במערכת."
        actions={
          <>
            {canManageUsers ? (
              <Button
                type="button"
                onClick={
                  openCreateModal
                }
                disabled={
                  isCreatingUser
                }
              >
                <UserPlus
                  size={18}
                  aria-hidden="true"
                />

                משתמש חדש
              </Button>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void loadUsers();
              }}
              disabled={
                usersState.isLoading ||
                isCreatingUser
              }
            >
              <RefreshCw
                size={18}
                aria-hidden="true"
              />

              רענון
            </Button>
          </>
        }
      />

      {!canManageUsers ? (
        <div
          className="users-error"
          role="status"
        >
          יש לך הרשאת צפייה
          במשתמשים, אך אין לך
          הרשאה ליצור, לערוך או
          להשבית משתמשים.
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
        inactive={
          statistics.inactive
        }
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
          authenticatedUser?.id ??
          null
        }
        updatingUserId={
          updatingUserId
        }
        onEditUser={
          openEditModal
        }
        onToggleActiveStatus={
          handleToggleActiveStatus
        }
      />

      {canManageUsers ? (
        <>
          <CreateUserModal
            isOpen={
              isCreateModalOpen
            }
            isSaving={
              isCreatingUser
            }
            onClose={
              closeCreateModal
            }
            onCreate={
              handleCreateUser
            }
          />

          <EditUserModal
            user={selectedUser}
            isOpen={
              isEditModalOpen
            }
            isSaving={Boolean(
              selectedUser &&
                updatingUserId ===
                  selectedUser.id,
            )}
            currentUserId={
              authenticatedUser?.id ??
              null
            }
            onClose={
              closeEditModal
            }
            onSave={
              handleSaveUser
            }
          />
        </>
      ) : null}
    </section>
  );
}

export default UsersPage;