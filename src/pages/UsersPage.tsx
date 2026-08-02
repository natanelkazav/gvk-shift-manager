import {
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import {
  useState,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import CreateUserModal from '../components/users/CreateUserModal';
import DeleteUserModal from '../components/users/DeleteUserModal';
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
  PermissionKey,
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
    refreshPermissions,
    hasPermission,
  } = useAuth();

  const canManageUsers =
    hasPermission(
      'users.manage',
    );

  const [
    filters,
    setFilters,
  ] =
    useState<UsersFiltersState>(
      initialFilters,
    );

  const [
    selectedUser,
    setSelectedUser,
  ] =
    useState<UserProfile | null>(
      null,
    );

  const [
    userToDelete,
    setUserToDelete,
  ] =
    useState<UserProfile | null>(
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

  const [
    isDeleteModalOpen,
    setIsDeleteModalOpen,
  ] = useState(false);

  const {
    usersState,
    filteredUsers,
    statistics,
    updatingUserId,
    deletingUserId,
    isCreatingUser,
    userPermissionsState,
    loadUsers,
    createUser,
    updateUser,
    toggleActiveStatus,
    deleteUser,
    loadUserPermissions,
    saveUserPermissions,
    resetUserPermissionsState,
    clearError,
  } = useUsers({
    authenticatedUserId:
      authenticatedUser?.id ??
      null,

    refreshAuthenticatedProfile:
      refreshProfile,

    refreshAuthenticatedPermissions:
      refreshPermissions,

    filters,
  });

  const isSelectedUserSaving =
    Boolean(
      selectedUser &&
        (
          updatingUserId ===
            selectedUser.id ||
          (
            userPermissionsState
              .userId ===
              selectedUser.id &&
            userPermissionsState
              .isSaving
          )
        ),
    );

  const isDeletingSelectedUser =
    Boolean(
      userToDelete &&
        deletingUserId ===
          userToDelete.id,
    );

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
      if (
        isCreatingUser ||
        userPermissionsState
          .isSaving
      ) {
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
    resetUserPermissionsState();

    setSelectedUser(profile);
    setIsEditModalOpen(true);

    void loadUserPermissions(
      profile.id,
    ).catch(() => {
      /*
       * השגיאה נשמרת בתוך
       * userPermissionsState.
       */
    });
  };

  const closeEditModal =
    (): void => {
      if (isSelectedUserSaving) {
        return;
      }

      setIsEditModalOpen(false);
      setSelectedUser(null);
      resetUserPermissionsState();
    };

  const openDeleteModal = (
    profile: UserProfile,
  ): void => {
    if (!canManageUsers) {
      return;
    }

    if (
      profile.id ===
      authenticatedUser?.id
    ) {
      return;
    }

    clearError();
    setUserToDelete(profile);
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal =
    (): void => {
      if (isDeletingSelectedUser) {
        return;
      }

      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    };

  const handleCreateUser =
    async (
      input: CreateUserInput,
      permissions:
        PermissionKey[],
    ): Promise<void> => {
      if (!canManageUsers) {
        throw new Error(
          'אין לך הרשאה ליצור משתמשים.',
        );
      }

      const createdUser =
        await createUser(input);

      try {
        await saveUserPermissions(
          createdUser.id,
          permissions,
        );
        } catch (error) {
          throw new Error(
            error instanceof Error
              ? `המשתמש נוצר בהצלחה, אך שמירת ההרשאות נכשלה: ${error.message}`
              : 'המשתמש נוצר בהצלחה, אך שמירת ההרשאות נכשלה.',
            {
              cause: error,
            },
          );
        }

      setIsCreateModalOpen(false);
      resetUserPermissionsState();
    };

  const handleSaveUser =
    async (
      userId: string,
      input:
        UpdateUserProfileInput,
      permissions:
        PermissionKey[],
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

      await saveUserPermissions(
        userId,
        permissions,
      );

      setIsEditModalOpen(false);
      setSelectedUser(null);
      resetUserPermissionsState();
    };

  const handleDeleteUser =
    async (
      userId: string,
      reason: string | null,
    ): Promise<void> => {
      if (!canManageUsers) {
        throw new Error(
          'אין לך הרשאה למחוק משתמשים.',
        );
      }

      await deleteUser({
        userId,
        reason,
      });

      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    };

  const handleRetryPermissions =
    async (): Promise<void> => {
      if (!selectedUser) {
        return;
      }

      await loadUserPermissions(
        selectedUser.id,
      );
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
                isCreatingUser ||
                Boolean(
                  deletingUserId,
                )
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
          הרשאה ליצור, לערוך,
          להשבית או למחוק משתמשים.
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
        admins={
          statistics.admins
        }
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
        deletingUserId={
          deletingUserId
        }
        onEditUser={
          openEditModal
        }
        onDeleteUser={
          openDeleteModal
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
              isCreatingUser ||
              userPermissionsState
                .isSaving
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
            isSaving={
              isSelectedUserSaving
            }
            currentUserId={
              authenticatedUser?.id ??
              null
            }
            permissions={
              selectedUser &&
              userPermissionsState
                .userId ===
                selectedUser.id
                ? userPermissionsState
                    .permissions
                : []
            }
            isPermissionsLoading={
              Boolean(
                selectedUser &&
                  userPermissionsState
                    .userId ===
                    selectedUser.id &&
                  userPermissionsState
                    .isLoading,
              )
            }
            permissionsError={
              selectedUser &&
              userPermissionsState
                .userId ===
                selectedUser.id
                ? userPermissionsState
                    .error
                : null
            }
            onRetryPermissions={
              handleRetryPermissions
            }
            onClose={
              closeEditModal
            }
            onSave={
              handleSaveUser
            }
          />

          <DeleteUserModal
            user={userToDelete}
            isOpen={
              isDeleteModalOpen
            }
            isDeleting={
              isDeletingSelectedUser
            }
            currentUserId={
              authenticatedUser?.id ??
              null
            }
            onClose={
              closeDeleteModal
            }
            onDelete={
              handleDeleteUser
            }
          />
        </>
      ) : null}
    </section>
  );
}

export default UsersPage;