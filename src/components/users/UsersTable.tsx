import {
  CheckCircle2,
  Pencil,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '../ui';
import type {
  UserProfile,
  UserRole,
} from '../../types/auth';

interface UsersTableProps {
  users: UserProfile[];
  isLoading: boolean;
  currentUserId: string | null;
  updatingUserId: string | null;
  deletingUserId: string | null;

  onEditUser: (
    profile: UserProfile,
  ) => void;

  onDeleteUser: (
    profile: UserProfile,
  ) => void;

  onToggleActiveStatus: (
    profile: UserProfile,
  ) => Promise<void>;
}

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

  const date =
    new Date(dateValue);

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
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

function UsersTable({
  users,
  isLoading,
  currentUserId,
  updatingUserId,
  deletingUserId,
  onEditUser,
  onDeleteUser,
  onToggleActiveStatus,
}: UsersTableProps) {
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

  if (users.length === 0) {
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
    <div className="users-table-container">
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
          {users.map(
            (profile) => {
              const isCurrentUser =
                profile.id ===
                currentUserId;

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
                <tr key={profile.id}>
                  <td>
                    <div className="users-user-cell">
                      <div className="users-avatar">
                        {profile
                          .displayName
                          .trim()
                          .charAt(0)
                          .toUpperCase() ||
                          '?'}
                      </div>

                      <div>
                        <strong>
                          {
                            profile
                              .displayName
                          }
                        </strong>

                        <span>
                          {
                            profile.email
                          }
                        </span>

                        {isCurrentUser ? (
                          <small>
                            המשתמש
                            הנוכחי
                          </small>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td>
                    {profile
                      .scheduleName ??
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
                      profile
                        .lastLoginAt,
                    )}
                  </td>

                  <td>
                    <div className="users-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isBusy}
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
                        variant={
                          profile.isActive
                            ? 'danger'
                            : 'secondary'
                        }
                        disabled={
                          isCurrentUser ||
                          isBusy
                        }
                        onClick={() => {
                          void onToggleActiveStatus(
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

                      <Button
                        type="button"
                        variant="danger"
                        disabled={
                          isCurrentUser ||
                          isBusy
                        }
                        onClick={() => {
                          onDeleteUser(
                            profile,
                          );
                        }}
                      >
                        <Trash2
                          size={16}
                          aria-hidden="true"
                        />

                        {isDeleting
                          ? 'מוחק...'
                          : 'מחיקה'}
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
  );
}

export default UsersTable;