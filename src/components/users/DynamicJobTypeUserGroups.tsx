/**
 * קובץ: src/components/users/DynamicJobTypeUserGroups.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור סוג תפקיד.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicJobTypeUserGroupsProps, formatDate, getInitials, DynamicJobTypeUserGroups.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * חוזה הנתונים DynamicJobTypeUserGroupsProps: סוג תפקיד.
 */
interface DynamicJobTypeUserGroupsProps {
  // users — משתמשים.
  users: UserProfile[];
  // jobTypes — סוגי תפקידים.
  jobTypes: DynamicJobType[];
  // currentUserId — המשתמש הנוכחי הנוכחי.
  currentUserId: string | null;
  // updatingUserId — מזהה משתמש.
  updatingUserId: string | null;
  // deletingUserId — מזהה משתמש.
  deletingUserId: string | null;
  // resettingPasswordUserId — מזהה משתמש.
  resettingPasswordUserId: string | null;
  canResetPasswords: boolean;
  // onEditUser — משתמש.
  onEditUser: (profile: UserProfile) => void;
  // onDeleteUser — משתמש.
  onDeleteUser: (profile: UserProfile) => void;
  // onResetPassword — סיסמה.
  onResetPassword: (profile: UserProfile) => Promise<void>;
  // onToggleActiveStatus — פעיל / סטטוס.
  onToggleActiveStatus: (profile: UserProfile) => Promise<void>;
}

/**
 * פעולה formatDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param dateValue — תאריך / ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDate(dateValue: string | null): string {
  if (!dateValue) return 'טרם התחבר';

  // date — תאריך.
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'לא ידוע';

  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

/**
 * פעולה getInitials: שליפה או חישוב של הנתון getInitials בהקשר הפעולה.
 * @param profile — פרופיל.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getInitials(profile: UserProfile): string {
  const parts = profile.displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]?.charAt(0).toUpperCase() || '?';

  return [parts[0]?.charAt(0), parts[parts.length - 1]?.charAt(0)]
    .filter(Boolean)
    .join('')
    .toUpperCase();
}

/**
 * פעולה DynamicJobTypeUserGroups: סוג תפקיד.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
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
  // מצב מקומי: collapsedJobTypes — סוגי תפקידים; setCollapsedJobTypes מעדכנת אותו ומפעילה רינדור לפי React.
  const [collapsedJobTypes, setCollapsedJobTypes] = useState<Record<string, boolean>>({});

  // ערך מחושב groups — קבוצות; נשמר בין רינדורים עד שינוי התלויות.
  const groups = useMemo(() => {
    // usersById — משתמשים / מזהה; מיפוי לחיפוש לפי מפתח.
    const usersById = new Map(users.map((profile) => [profile.id, profile]));

    return jobTypes
      .filter((jobType) => jobType.isActive)
      .map((jobType) => {
        // memberUsers — משתמשים.
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
        // isCollapsed — הנתון isCollapsed בהקשר הפעולה.
        const isCollapsed = collapsedJobTypes[jobType.id] ?? true;
        // contentId — מזהה.
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
                        // isCurrentUser — המשתמש הנוכחי.
                        const isCurrentUser = profile.id === currentUserId;
                        // isUpdating — הנתון isUpdating בהקשר הפעולה.
                        const isUpdating = updatingUserId === profile.id;
                        // isDeleting — הנתון isDeleting בהקשר הפעולה.
                        const isDeleting = deletingUserId === profile.id;
                        // isResettingPassword — סיסמה.
                        const isResettingPassword = resettingPasswordUserId === profile.id;
                        // isBusy — הנתון isBusy בהקשר הפעולה.
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
