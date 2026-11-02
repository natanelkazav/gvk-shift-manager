/**
 * קובץ: src/pages/UsersPage.tsx
 * מטרה: מימוש מסך המשתמש עבור משתמשים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UsersPageSection, UsersPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  BriefcaseBusiness,
  RefreshCw,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import {
  useEffect,
  useState,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import CreateUserModal from '../components/users/CreateUserModal';
import DeleteUserModal from '../components/users/DeleteUserModal';
import EditUserModal from '../components/users/EditUserModal';
import UsersFilters from '../components/users/UsersFilters';
import UsersStatistics from '../components/users/UsersStatistics';
import DynamicJobTypesPanel from '../components/users/dynamic/DynamicJobTypesPanel';
import ClientVersionAdminPanel from '../components/users/ClientVersionAdminPanel';
import UsersTable from '../components/users/UsersTable';
import {
  Button,
  PageHeader,
} from '../components/ui';
import { useUsers } from '../hooks/useUsers';
import { dynamicCutoverService } from '../services/dynamicCutoverService';
import { dynamicSchedulingService } from '../services/dynamicSchedulingService';
import { dynamicPermissionEngineService } from '../services/dynamicPermissionEngineService';
import { dynamicUserAssignmentsService } from '../services/dynamicUserAssignmentsService';
import type { DynamicUserJobTypePermissionSelection } from '../types/dynamicPermissionEngine';
import type { DynamicUserAssignmentSelection } from '../types/dynamicUserAssignments';
import type {
  PermissionKey,
  UserProfile,
} from '../types/auth';
import type { DynamicJobType } from '../types/dynamicScheduling';
import type {
  CreateUserInput,
  UpdateUserProfileInput,
  UsersFilters as UsersFiltersState,
} from '../types/users';
import '../styles/users.css';

// initialFilters — מסננים.
const initialFilters:
  UsersFiltersState = {
    searchTerm: '',
    role: 'all',
    status: 'all',
  };

/**
 * טיפוס UsersPageSection: משתמשים.
 */
type UsersPageSection =
  | 'users'
  | 'job-types';

/**
 * פעולה UsersPage: משתמשים.
 */
function UsersPage() {
  const {
    user: authenticatedUser,
    refreshProfile,
    refreshPermissions,
    hasPermission,
  } = useAuth();

  // canManageUsers — האם פעולת ניהול מותרת.
  const canManageUsers =
    hasPermission(
      'users.manage',
    );

  // canManagePayroll — האם פעולת ניהול מותרת.
  const canManagePayroll =
    hasPermission(
      'payroll.manage',
    );

  // canSendUpdateNotifications — התראות.
  const canSendUpdateNotifications =
    hasPermission(
      'notifications.manage',
    );

  // canResetPasswords — הנתון canResetPasswords בהקשר הפעולה.
  const canResetPasswords =
    hasPermission(
      'users.manage',
    );

  // מצב מקומי: activeSection — פעיל; setActiveSection מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    activeSection,
    setActiveSection,
  ] = useState<UsersPageSection>(
    'users',
  );

  // מצב מקומי: filters — מסננים; setFilters מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    filters,
    setFilters,
  ] =
    useState<UsersFiltersState>(
      initialFilters,
    );

  // מצב מקומי: dynamicJobTypes — סוגי תפקידים; setDynamicJobTypes מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    dynamicJobTypes,
    setDynamicJobTypes,
  ] = useState<DynamicJobType[]>([]);

  // מצב מקומי: dynamicFirstEnabled — דינמי / האם האפשרות מופעלת; setDynamicFirstEnabled מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    dynamicFirstEnabled,
    setDynamicFirstEnabled,
  ] = useState(false);

  // מצב מקומי: selectedUser — נבחר / משתמש; setSelectedUser מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    selectedUser,
    setSelectedUser,
  ] =
    useState<UserProfile | null>(
      null,
    );

  // מצב מקומי: userToDelete — משתמש; setUserToDelete מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    userToDelete,
    setUserToDelete,
  ] =
    useState<UserProfile | null>(
      null,
    );

  // מצב מקומי: isEditModalOpen — הנתון isEditModalOpen בהקשר הפעולה; setIsEditModalOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isEditModalOpen,
    setIsEditModalOpen,
  ] = useState(false);

  // מצב מקומי: isCreateModalOpen — הנתון isCreateModalOpen בהקשר הפעולה; setIsCreateModalOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isCreateModalOpen,
    setIsCreateModalOpen,
  ] = useState(false);

  // מצב מקומי: isDeleteModalOpen — הנתון isDeleteModalOpen בהקשר הפעולה; setIsDeleteModalOpen מעדכנת אותו ומפעילה רינדור לפי React.
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
    resettingPasswordUserId,
    isCreatingUser,
    lastResetPasswordResult,
    userPermissionsState,
    loadUsers,
    createUser,
    updateUser,
    toggleActiveStatus,
    deleteUser,
    resetUserPassword,
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

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [activeSection].
  useEffect(() => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר activeSection !== 'users'.
    if (activeSection !== 'users') {
      return;
    }

    // isCancelled — הנתון isCancelled בהקשר הפעולה.
    let isCancelled = false;

    void Promise.all([
      dynamicSchedulingService.getAdminData(),
      dynamicCutoverService.getState(),
    ])
      .then(([adminData, cutoverState]) => {
        if (isCancelled) return;
        setDynamicJobTypes(adminData.jobTypes ?? []);
        setDynamicFirstEnabled(cutoverState.dynamicFirstEnabled);
      })
      .catch(() => {
        if (isCancelled) return;
        setDynamicJobTypes([]);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeSection]);

  // isSelectedUserSaving — נבחר / משתמש / שמירה.
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

  // isDeletingSelectedUser — נבחר / משתמש.
  const isDeletingSelectedUser =
    Boolean(
      userToDelete &&
        deletingUserId ===
          userToDelete.id,
    );

  /**
   * פעולה openCreateModal: פתיחת הנתון openCreateModal בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const openCreateModal =
    (): void => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canManageUsers.
      if (!canManageUsers) {
        return;
      }

      clearError();
      setIsCreateModalOpen(true);
    };

  /**
   * פעולה closeCreateModal: סגירת הנתון closeCreateModal בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const closeCreateModal =
    (): void => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCreatingUser || userPermissionsState .isSaving.
      if (
        isCreatingUser ||
        userPermissionsState
          .isSaving
      ) {
        return;
      }

      setIsCreateModalOpen(false);
    };

  /**
   * פעולה openEditModal: פתיחת הנתון openEditModal בהקשר הפעולה.
   * @param profile — פרופיל.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const openEditModal = (
    profile: UserProfile,
  ): void => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canManageUsers.
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

  /**
   * פעולה closeEditModal: סגירת הנתון closeEditModal בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const closeEditModal =
    (): void => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isSelectedUserSaving.
      if (isSelectedUserSaving) {
        return;
      }

      setIsEditModalOpen(false);
      setSelectedUser(null);
      resetUserPermissionsState();
    };

  /**
   * פעולה openDeleteModal: פתיחת הנתון openDeleteModal בהקשר הפעולה.
   * @param profile — פרופיל.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const openDeleteModal = (
    profile: UserProfile,
  ): void => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canManageUsers.
    if (!canManageUsers) {
      return;
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר profile.id === authenticatedUser?.id.
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

  /**
   * פעולה closeDeleteModal: סגירת הנתון closeDeleteModal בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const closeDeleteModal =
    (): void => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isDeletingSelectedUser.
      if (isDeletingSelectedUser) {
        return;
      }

      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    };

  /**
   * פעולה אסינכרונית handleCreateUser: טיפול באירוע עבור משתמש.
   * @param input — קלט.
   * @param permissions — הרשאות.
   * @param assignments — הקצאות.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleCreateUser =
    async (
      input: CreateUserInput,
      permissions:
        PermissionKey[],
      assignments:
        DynamicUserAssignmentSelection[],
    ): Promise<void> => {
      // עצירת הפעולה עם שגיאה כאשר !canManageUsers.
      if (!canManageUsers) {
        throw new Error(
          'אין לך הרשאה ליצור משתמשים.',
        );
      }

      // createdUser — משתמש.
      const createdUser =
        await createUser(input);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await saveUserPermissions(
          createdUser.id,
          permissions,
        );

        await dynamicUserAssignmentsService.save(
          createdUser.id,
          assignments,
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

  /**
   * פעולה אסינכרונית handleSaveUser: טיפול באירוע עבור משתמש.
   * @param userId — מזהה משתמש.
   * @param input — קלט.
   * @param permissions — הרשאות.
   * @param dynamicJobTypePermissions — סוג תפקיד.
   * @param assignments — הקצאות.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleSaveUser =
    async (
      userId: string,
      input:
        UpdateUserProfileInput,
      permissions:
        PermissionKey[],
      dynamicJobTypePermissions:
        DynamicUserJobTypePermissionSelection[],
      assignments:
        DynamicUserAssignmentSelection[],
    ): Promise<void> => {
      // עצירת הפעולה עם שגיאה כאשר !canManageUsers.
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

      await dynamicUserAssignmentsService.save(
        userId,
        assignments,
      );

      await dynamicPermissionEngineService.saveUserJobTypePermissions(
        userId,
        dynamicJobTypePermissions,
      );

      setIsEditModalOpen(false);
      setSelectedUser(null);
      resetUserPermissionsState();
    };

  /**
   * פעולה אסינכרונית handleDeleteUser: טיפול באירוע עבור משתמש.
   * @param userId — מזהה משתמש.
   * @param reason — הנתון reason בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleDeleteUser =
    async (
      userId: string,
      reason: string | null,
    ): Promise<void> => {
      // עצירת הפעולה עם שגיאה כאשר !canManageUsers.
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

  /**
   * פעולה אסינכרונית handleRetryPermissions: טיפול באירוע עבור הרשאות.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleRetryPermissions =
    async (): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !selectedUser.
      if (!selectedUser) {
        return;
      }

      await loadUserPermissions(
        selectedUser.id,
      );
    };

  /**
   * פעולה אסינכרונית handleToggleActiveStatus: טיפול באירוע עבור פעיל / סטטוס.
   * @param profile — פרופיל.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleToggleActiveStatus =
    async (
      profile: UserProfile,
    ): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canManageUsers.
      if (!canManageUsers) {
        return;
      }

      await toggleActiveStatus(
        profile,
      );
    };


  /**
   * פעולה אסינכרונית handleResetPassword: טיפול באירוע עבור סיסמה.
   * @param profile — פרופיל.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleResetPassword =
    async (
      profile:
        UserProfile,
    ): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !canResetPasswords || resettingPasswordUserId.
      if (
        !canResetPasswords ||
        resettingPasswordUserId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `האם לשלוח ל${profile.displayName} קישור מאובטח לאיפוס הסיסמה?\n\n` +
          `הקישור יישלח לכתובת ${profile.email}.`,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
      if (!confirmed) {
        return;
      }

      await resetUserPassword(
        profile.id,
      );
    };

  return (
    <section className="users-page">
      <PageHeader
        title="ניהול משתמשים"
        description="ניהול משתמשים, תפקידים והרשאות במערכת."
        actions={activeSection === 'users' ? (
          <>
            {canManageUsers ? (
              <Button
                type="button"
                onClick={openCreateModal}
                disabled={isCreatingUser}
              >
                <UserPlus size={18} aria-hidden="true" />
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
                Boolean(deletingUserId)
              }
            >
              <RefreshCw size={18} aria-hidden="true" />
              רענון
            </Button>
          </>
        ) : undefined}
      />

      <div className="users-page-tabs" role="tablist" aria-label="ניהול משתמשים ותפקידים">
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'users'}
          className={activeSection === 'users' ? 'is-active' : ''}
          onClick={() => setActiveSection('users')}
        >
          <UsersRound size={17} />
          משתמשים
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === 'job-types'}
          className={activeSection === 'job-types' ? 'is-active' : ''}
          onClick={() => setActiveSection('job-types')}
        >
          <BriefcaseBusiness size={17} />
          סוגי תפקידים ומערכי שיבוץ
        </button>
      </div>

      {activeSection === 'job-types' ? (
        <DynamicJobTypesPanel
          canManage={canManageUsers}
        />
      ) : (
        <>
          {canManageUsers ? (
            <ClientVersionAdminPanel
              canSendUpdateNotifications={canSendUpdateNotifications}
            />
          ) : null}
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


      {lastResetPasswordResult ? (
        <div
          className="users-success"
          role="status"
        >
          קישור מאובטח לאיפוס הסיסמה נשלח אל{' '}
          <strong>
            {
              lastResetPasswordResult
                .email
            }
          </strong>
          {' '}עבור{' '}
          <strong>
            {
              lastResetPasswordResult
                .displayName
            }
          </strong>
          .
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
        resettingPasswordUserId={
          resettingPasswordUserId
        }
        canResetPasswords={
          canResetPasswords
        }
        dynamicJobTypes={
          dynamicJobTypes
        }
        dynamicFirstEnabled={
          dynamicFirstEnabled
        }
        onEditUser={
          openEditModal
        }
        onDeleteUser={
          openDeleteModal
        }
        onResetPassword={
          handleResetPassword
        }
        onToggleActiveStatus={
          handleToggleActiveStatus
        }
      />

      {canManageUsers ? (
        <>
          <CreateUserModal
            dynamicJobTypes={dynamicJobTypes}
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
            dynamicJobTypes={dynamicJobTypes}
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
            canManagePayroll={
              canManagePayroll
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
        </>
      )}
    </section>
  );
}

export default UsersPage;