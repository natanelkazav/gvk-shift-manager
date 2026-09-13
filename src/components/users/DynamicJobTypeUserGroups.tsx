import {
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  KeyRound,
  Pencil,
  Power,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { UserProfile } from '../../types/auth';
import type { DynamicJobType } from '../../types/dynamicScheduling';
import { Button } from '../ui';

interface DynamicJobTypeUserGroupsProps {
  users: UserProfile[];
  jobTypes: DynamicJobType[];
  currentUserId: string | null;
  updatingUserId: string | null;
  deletingUserId: string | null;
  resettingPasswordUserId: string | null;
  canResetPasswords: boolean;
  onEditUser: (profile: UserProfile) => void;
  onDeleteUser: (profile: UserProfile) => void;
  onResetPassword: (profile: UserProfile) => Promise<void>;
  onToggleActiveStatus: (profile: UserProfile) => Promise<void>;
}

function formatDate(dateValue: string | null): string {
  if (!dateValue) return 'טרם התחבר';

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'לא ידוע';

  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getInitials(profile: UserProfile): string {
  const parts = profile.displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]?.charAt(0).toUpperCase() || '?';

  return [parts[0]?.charAt(0), parts[parts.length - 1]?.charAt(0)]
    .filter(Boolean)
    .join('')
    .toUpperCase();
}

export default function DynamicJobTypeUserGroups({
  users,
  jobTypes,
  currentUserId,
  updatingUserId,
  deletingUserId,
  resettingPasswordUserId,
  canResetPasswords,
  onEditUser,
  onDeleteUser,
  onResetPassword,
  onToggleActiveStatus,
}: DynamicJobTypeUserGroupsProps) {
  const [collapsedJobTypes, setCollapsedJobTypes] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const usersById = new Map(users.map((profile) => [profile.id, profile]));

    return jobTypes
      .filter((jobType) => jobType.isActive)
      .map((jobType) => {
        const memberUsers = jobType.members
          .map((member) => usersById.get(member.userId))
          .filter((profile): profile is UserProfile => Boolean(profile?.isActive));

        return {
          jobType,
          users: memberUsers,
        };
      })
      .filter((group) => group.users.length > 0)
      .sort((left, right) => left.jobType.name.localeCompare(right.jobType.name, 'he'));
  }, [jobTypes, users]);

  if (groups.length === 0) return null;

  return (
    <>
      {groups.map(({ jobType, users: groupUsers }) => {
        const isCollapsed = collapsedJobTypes[jobType.id] ?? true;
        const contentId = `users-dynamic-job-type-${jobType.id}`;

        return (
          <section
            key={jobType.id}
            className={[
              'users-role-group',
              'users-dynamic-job-type-group',
              isCollapsed ? 'users-role-group-collapsed' : '',
            ].filter(Boolean).join(' ')}
          >
            <button
              type="button"
              className="users-role-group-header"
              aria-expanded={!isCollapsed}
              aria-controls={contentId}
              onClick={() => {
                setCollapsedJobTypes((current) => ({
                  ...current,
                  [jobType.id]: !(current[jobType.id] ?? true),
                }));
              }}
            >
              <span className="users-role-group-icon">
                <BriefcaseBusiness size={22} aria-hidden="true" />
              </span>

              <span className="users-role-group-heading">
                <span className="users-role-group-title-row">
                  <strong>{jobType.name}</strong>
                  <span className="users-role-group-count">{groupUsers.length}</span>
                </span>
                <small>{jobType.description?.trim() || 'תפקיד דינמי ומערך שיבוץ'}</small>
              </span>

              <span className="users-role-group-summary">
                <span className="users-role-group-active-count">
                  {groupUsers.length} פעילים
                </span>
              </span>

              <span className="users-role-group-toggle">
                {isCollapsed ? (
                  <ChevronLeft size={20} aria-hidden="true" />
                ) : (
                  <ChevronDown size={20} aria-hidden="true" />
                )}
              </span>
            </button>

            {!isCollapsed ? (
              <div id={contentId} className="users-role-group-content">
                <div className="users-group-table-wrapper">
                  <table className="users-table users-group-table">
                    <thead>
                      <tr>
                        <th>משתמש</th>
                        <th>שם שיבוץ</th>
                        <th>תפקיד דינמי</th>
                        <th>סטטוס</th>
                        <th>התחברות אחרונה</th>
                        <th>פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupUsers.map((profile) => {
                        const isCurrentUser = profile.id === currentUserId;
                        const isUpdating = updatingUserId === profile.id;
                        const isDeleting = deletingUserId === profile.id;
                        const isResettingPassword = resettingPasswordUserId === profile.id;
                        const isBusy = isUpdating || isDeleting || isResettingPassword;

                        return (
                          <tr
                            key={profile.id}
                            className={isCurrentUser ? 'users-row-current' : ''}
                          >
                            <td>
                              <div className="users-user-cell">
                                <div className="users-avatar">{getInitials(profile)}</div>
                                <div className="users-user-details">
                                  <div className="users-user-name-row">
                                    <strong>{profile.displayName}</strong>
                                    {isCurrentUser ? (
                                      <span className="users-current-user-badge">אתה</span>
                                    ) : null}
                                  </div>
                                  <span>{profile.email}</span>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className="users-schedule-name">
                                {profile.scheduleName ?? 'לא הוגדר'}
                              </span>
                            </td>

                            <td>
                              <span className="users-role-badge users-role-badge-dynamic">
                                {jobType.name}
                              </span>
                            </td>

                            <td>
                              <span className="users-status users-status-active">
                                <CheckCircle2 size={15} aria-hidden="true" />
                                פעיל
                              </span>
                            </td>

                            <td>
                              <span className="users-last-login">{formatDate(profile.lastLoginAt)}</span>
                            </td>

                            <td>
                              <div className="users-actions users-icon-actions">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  disabled={isBusy}
                                  title={`עריכת ${profile.displayName}`}
                                  aria-label={`עריכת ${profile.displayName}`}
                                  onClick={() => onEditUser(profile)}
                                >
                                  <Pencil size={16} aria-hidden="true" />
                                </Button>

                                {canResetPasswords ? (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    disabled={isBusy}
                                    title={`איפוס הסיסמה של ${profile.displayName}`}
                                    aria-label={`איפוס הסיסמה של ${profile.displayName}`}
                                    onClick={() => void onResetPassword(profile)}
                                  >
                                    {isResettingPassword ? (
                                      <RefreshCw
                                        size={16}
                                        className="users-action-loading-icon"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <KeyRound size={16} aria-hidden="true" />
                                    )}
                                  </Button>
                                ) : null}

                                <Button
                                  type="button"
                                  variant="danger"
                                  disabled={isCurrentUser || isBusy}
                                  title={
                                    isCurrentUser
                                      ? 'לא ניתן להשבית את המשתמש הנוכחי'
                                      : `השבתת ${profile.displayName}`
                                  }
                                  aria-label={`השבתת ${profile.displayName}`}
                                  onClick={() => void onToggleActiveStatus(profile)}
                                >
                                  {isUpdating ? (
                                    <RefreshCw
                                      size={16}
                                      className="users-action-loading-icon"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Power size={16} aria-hidden="true" />
                                  )}
                                </Button>

                                <Button
                                  type="button"
                                  variant="danger"
                                  disabled={isCurrentUser || isBusy}
                                  title={
                                    isCurrentUser
                                      ? 'לא ניתן למחוק את המשתמש הנוכחי'
                                      : `מחיקת ${profile.displayName}`
                                  }
                                  aria-label={`מחיקת ${profile.displayName}`}
                                  onClick={() => onDeleteUser(profile)}
                                >
                                  {isDeleting ? (
                                    <RefreshCw
                                      size={16}
                                      className="users-action-loading-icon"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Trash2 size={16} aria-hidden="true" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
