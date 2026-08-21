import {
  CheckCheck,
  ChevronDown,
  KeyRound,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import {
  useMemo,
  useState,
} from 'react';
import type {
  PermissionKey,
} from '../../types/auth';
import {
  allPermissionKeys,
  permissionGroups,
  type PermissionGroup,
} from '../../constants/permissions';
import { Button } from '../ui';

interface UserPermissionsTabProps {
  selectedPermissions:
    PermissionKey[];
  isDisabled?: boolean;
  onChange: (
    permissions: PermissionKey[],
  ) => void;
}

function normalizeSearchValue(
  value: string,
): string {
  return value
    .trim()
    .toLocaleLowerCase('he');
}

function UserPermissionsTab({
  selectedPermissions,
  isDisabled = false,
  onChange,
}: UserPermissionsTabProps) {
  const [
    searchTerm,
    setSearchTerm,
  ] = useState('');

  const [
    openGroups,
    setOpenGroups,
  ] = useState<Set<string>>(
    () => new Set(),
  );

  const selectedPermissionSet =
    useMemo(
      () =>
        new Set(
          selectedPermissions,
        ),
      [selectedPermissions],
    );

  const normalizedSearchTerm =
    normalizeSearchValue(
      searchTerm,
    );

  const filteredGroups =
    useMemo<PermissionGroup[]>(
      () => {
        if (!normalizedSearchTerm) {
          return permissionGroups;
        }

        return permissionGroups
          .map((group) => {
            const groupMatches =
              normalizeSearchValue(
                `${group.title} ${group.description}`,
              ).includes(
                normalizedSearchTerm,
              );

            if (groupMatches) {
              return group;
            }

            const matchingPermissions =
              group.permissions.filter(
                (permission) =>
                  normalizeSearchValue(
                    `${permission.label} ${permission.description}`,
                  ).includes(
                    normalizedSearchTerm,
                  ),
              );

            if (
              matchingPermissions.length ===
              0
            ) {
              return null;
            }

            return {
              ...group,
              permissions:
                matchingPermissions,
            };
          })
          .filter(
            (
              group,
            ): group is PermissionGroup =>
              Boolean(group),
          );
      },
      [normalizedSearchTerm],
    );

  const handlePermissionChange = (
    permission: PermissionKey,
    isSelected: boolean,
  ): void => {
    if (isDisabled) {
      return;
    }

    const nextPermissionSet =
      new Set(
        selectedPermissions,
      );

    if (isSelected) {
      nextPermissionSet.add(
        permission,
      );
    } else {
      nextPermissionSet.delete(
        permission,
      );
    }

    onChange(
      allPermissionKeys.filter(
        (currentPermission) =>
          nextPermissionSet.has(
            currentPermission,
          ),
      ),
    );
  };

  const handleSelectAll =
    (): void => {
      if (isDisabled) {
        return;
      }

      onChange([
        ...allPermissionKeys,
      ]);
    };

  const handleClearAll =
    (): void => {
      if (isDisabled) {
        return;
      }

      onChange([]);
    };

  const handleSelectGroup = (
    group: PermissionGroup,
  ): void => {
    if (isDisabled) {
      return;
    }

    const nextPermissionSet =
      new Set(
        selectedPermissions,
      );

    group.permissions.forEach(
      (permission) => {
        nextPermissionSet.add(
          permission.key,
        );
      },
    );

    onChange(
      allPermissionKeys.filter(
        (permission) =>
          nextPermissionSet.has(
            permission,
          ),
      ),
    );
  };

  const handleClearGroup = (
    group: PermissionGroup,
  ): void => {
    if (isDisabled) {
      return;
    }

    const groupPermissionSet =
      new Set(
        group.permissions.map(
          (permission) =>
            permission.key,
        ),
      );

    onChange(
      selectedPermissions.filter(
        (permission) =>
          !groupPermissionSet.has(
            permission,
          ),
      ),
    );
  };

  const selectedCount =
    selectedPermissions.length;

  return (
    <div className="user-permissions-tab">
      <div className="user-permissions-toolbar">
        <div className="user-permissions-summary">
          <div
            className="user-permissions-summary-icon"
            aria-hidden="true"
          >
            <KeyRound size={20} />
          </div>

          <div>
            <strong>
              הרשאות משתמש
            </strong>

            <span>
              נבחרו {selectedCount} מתוך{' '}
              {allPermissionKeys.length}{' '}
              הרשאות
            </span>
          </div>
        </div>

        <div className="user-permissions-toolbar-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={
              isDisabled ||
              selectedCount === 0
            }
            onClick={handleClearAll}
          >
            <RotateCcw
              size={16}
              aria-hidden="true"
            />

            נקה הכול
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={
              isDisabled ||
              selectedCount ===
                allPermissionKeys.length
            }
            onClick={handleSelectAll}
          >
            <CheckCheck
              size={16}
              aria-hidden="true"
            />

            בחר הכול
          </Button>
        </div>
      </div>

      <label className="user-permissions-search">
        <Search
          size={18}
          aria-hidden="true"
        />

        <input
          type="search"
          value={searchTerm}
          placeholder="חיפוש לפי שם הרשאה, הסבר או תחום..."
          disabled={isDisabled}
          onChange={(event) => {
            setSearchTerm(
              event.target.value,
            );
          }}
        />

        {searchTerm ? (
          <button
            type="button"
            aria-label="ניקוי החיפוש"
            disabled={isDisabled}
            onClick={() => {
              setSearchTerm('');
            }}
          >
            <X
              size={17}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </label>

      {filteredGroups.length === 0 ? (
        <div className="user-permissions-empty-search">
          <Search
            size={28}
            aria-hidden="true"
          />

          <strong>
            לא נמצאו הרשאות מתאימות
          </strong>

          <span>
            נסה לחפש לפי שם מסך, פעולה או סוג משתמש.
          </span>
        </div>
      ) : (
        <div className="user-permissions-groups">
          {filteredGroups.map(
            (group) => {
              const selectedGroupCount =
                group.permissions.filter(
                  (permission) =>
                    selectedPermissionSet.has(
                      permission.key,
                    ),
                ).length;

              const isEntireGroupSelected =
                selectedGroupCount ===
                group.permissions.length;

              const isOpen =
                Boolean(
                  normalizedSearchTerm,
                ) ||
                openGroups.has(
                  group.id,
                );

              const toggleGroup =
                (): void => {
                  setOpenGroups(
                    (currentGroups) => {
                      const nextGroups =
                        new Set(
                          currentGroups,
                        );

                      if (
                        nextGroups.has(
                          group.id,
                        )
                      ) {
                        nextGroups.delete(
                          group.id,
                        );
                      } else {
                        nextGroups.add(
                          group.id,
                        );
                      }

                      return nextGroups;
                    },
                  );
                };

              return (
                <section
                  key={group.id}
                  className={[
                    'user-permissions-group',
                    `user-permissions-group-${group.tone}`,
                    isOpen
                      ? 'user-permissions-group-open'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <header className="user-permissions-group-header">
                    <button
                      type="button"
                      className="user-permissions-group-toggle"
                      aria-expanded={isOpen}
                      onClick={toggleGroup}
                    >
                      <span
                        className="user-permissions-group-accent"
                        aria-hidden="true"
                      />

                      <span className="user-permissions-group-heading-text">
                        <strong>
                          {group.title}
                        </strong>

                        <small>
                          {group.description}
                        </small>
                      </span>

                      <ChevronDown
                        size={18}
                        className="user-permissions-group-chevron"
                        aria-hidden="true"
                      />
                    </button>

                    <div className="user-permissions-group-summary">
                      <span>
                        {selectedGroupCount} מתוך{' '}
                        {group.permissions.length}{' '}
                        הרשאות
                      </span>

                      <div className="user-permissions-group-actions">
                        <button
                          type="button"
                          disabled={
                            isDisabled ||
                            isEntireGroupSelected
                          }
                          onClick={() => {
                            handleSelectGroup(
                              group,
                            );
                          }}
                        >
                          בחר קבוצה
                        </button>

                        <button
                          type="button"
                          disabled={
                            isDisabled ||
                            selectedGroupCount === 0
                          }
                          onClick={() => {
                            handleClearGroup(
                              group,
                            );
                          }}
                        >
                          נקה קבוצה
                        </button>
                      </div>
                    </div>
                  </header>

                  {isOpen ? (
                    <div className="user-permissions-list">
                      {group.permissions.map(
                        (permission) => {
                          const isSelected =
                            selectedPermissionSet.has(
                              permission.key,
                            );

                          return (
                            <label
                              key={permission.key}
                              className={[
                                'user-permission-item',
                                isSelected
                                  ? 'user-permission-item-selected'
                                  : '',
                                isDisabled
                                  ? 'user-permission-item-disabled'
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isDisabled}
                                onChange={(event) => {
                                  handlePermissionChange(
                                    permission.key,
                                    event.target.checked,
                                  );
                                }}
                              />

                              <span className="user-permission-switch">
                                <span />
                              </span>

                              <span className="user-permission-content">
                                <strong>
                                  {permission.label}
                                </strong>

                                <small>
                                  {permission.description}
                                </small>
                              </span>
                            </label>
                          );
                        },
                      )}
                    </div>
                  ) : null}
                </section>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

export default UserPermissionsTab;