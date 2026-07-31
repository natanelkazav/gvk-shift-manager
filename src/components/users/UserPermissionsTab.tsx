import {
  CheckCheck,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import type {
  PermissionKey,
} from '../../types/auth';
import {
  allPermissionKeys,
  permissionGroups,
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

function UserPermissionsTab({
  selectedPermissions,
  isDisabled = false,
  onChange,
}: UserPermissionsTabProps) {
  const selectedPermissionSet =
    new Set(selectedPermissions);

  const handlePermissionChange = (
    permission: PermissionKey,
    isSelected: boolean,
  ): void => {
    if (isDisabled) {
      return;
    }

    if (isSelected) {
      onChange([
        ...selectedPermissions,
        permission,
      ]);

      return;
    }

    onChange(
      selectedPermissions.filter(
        (currentPermission) =>
          currentPermission !==
          permission,
      ),
    );
  };

  const handleSelectAll =
    (): void => {
      if (isDisabled) {
        return;
      }

      onChange([...allPermissionKeys]);
    };

  const handleClearAll =
    (): void => {
      if (isDisabled) {
        return;
      }

      onChange([]);
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
            disabled={isDisabled}
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
            disabled={isDisabled}
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

      <div className="user-permissions-groups">
        {permissionGroups.map(
          (group) => (
            <section
              key={group.id}
              className="user-permissions-group"
            >
              <header className="user-permissions-group-header">
                <div>
                  <h3>
                    {group.title}
                  </h3>

                  <p>
                    {group.description}
                  </p>
                </div>

                <span>
                  {
                    group.permissions.filter(
                      (permission) =>
                        selectedPermissionSet.has(
                          permission.key,
                        ),
                    ).length
                  }
                  /
                  {
                    group.permissions
                      .length
                  }
                </span>
              </header>

              <div className="user-permissions-list">
                {group.permissions.map(
                  (permission) => {
                    const isSelected =
                      selectedPermissionSet.has(
                        permission.key,
                      );

                    return (
                      <label
                        key={
                          permission.key
                        }
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
                          checked={
                            isSelected
                          }
                          disabled={
                            isDisabled
                          }
                          onChange={(
                            event,
                          ) => {
                            handlePermissionChange(
                              permission.key,
                              event.target
                                .checked,
                            );
                          }}
                        />

                        <span className="user-permission-switch">
                          <span />
                        </span>

                        <span className="user-permission-content">
                          <strong>
                            {
                              permission.label
                            }
                          </strong>

                          <small>
                            {
                              permission.description
                            }
                          </small>

                          <code>
                            {
                              permission.key
                            }
                          </code>
                        </span>
                      </label>
                    );
                  },
                )}
              </div>
            </section>
          ),
        )}
      </div>
    </div>
  );
}

export default UserPermissionsTab;