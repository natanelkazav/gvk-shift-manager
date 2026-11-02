/**
 * קובץ: src/components/users/UserPermissionsTab.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור משתמש / הרשאות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UserPermissionsTabProps, normalizeSearchValue, UserPermissionsTab.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * חוזה הנתונים UserPermissionsTabProps: משתמש / הרשאות / מאפייני הרכיב.
 */
interface UserPermissionsTabProps {
  // selectedPermissions — נבחר / הרשאות.
  selectedPermissions:
    PermissionKey[];
  // isDisabled — האם האפשרות מושבתת (אופציונלי).
  isDisabled?: boolean;
  // onChange — פונקציית דיווח על שינוי.
  onChange: (
    permissions: PermissionKey[],
  ) => void;
  // allowedPermissionKeys — מפתחות ההרשאות (אופציונלי).
  allowedPermissionKeys?: PermissionKey[];
  // title — כותרת (אופציונלי).
  title?: string;
}

/**
 * פעולה normalizeSearchValue: נרמול ערך.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeSearchValue(
  value: string,
): string {
  return value
    .trim()
    .toLocaleLowerCase('he');
}

/**
 * פעולה UserPermissionsTab: משתמש / הרשאות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function UserPermissionsTab({
  selectedPermissions,
  isDisabled = false,
  onChange,
  allowedPermissionKeys,
  title = 'הרשאות משתמש',
}: UserPermissionsTabProps) {
  // מצב מקומי: searchTerm — הנתון searchTerm בהקשר הפעולה; setSearchTerm מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    searchTerm,
    setSearchTerm,
  ] = useState('');

  // מצב מקומי: openGroups — קבוצות; setOpenGroups מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    openGroups,
    setOpenGroups,
  ] = useState<Set<string>>(
    () => new Set(),
  );

  // ערך מחושב selectedPermissionSet — נבחר / הרשאות / קבוצה ייחודית; נשמר בין רינדורים עד שינוי התלויות.
  const selectedPermissionSet =
    useMemo(
      () =>
        new Set(
          selectedPermissions,
        ),
      [selectedPermissions],
    );

  // ערך מחושב visiblePermissionKeys — מפתחות ההרשאות; נשמר בין רינדורים עד שינוי התלויות.
  const visiblePermissionKeys = useMemo(
    () => allowedPermissionKeys ?? allPermissionKeys,
    [allowedPermissionKeys],
  );
  // ערך מחושב visiblePermissionKeySet — מפתח ההרשאה; נשמר בין רינדורים עד שינוי התלויות.
  const visiblePermissionKeySet = useMemo(
    () => new Set<PermissionKey>(visiblePermissionKeys),
    [visiblePermissionKeys],
  );

  // normalizedSearchTerm — הנתון normalizedSearchTerm בהקשר הפעולה.
  const normalizedSearchTerm =
    normalizeSearchValue(
      searchTerm,
    );

  // ערך מחושב filteredGroups — קבוצות; נשמר בין רינדורים עד שינוי התלויות.
  const filteredGroups =
    useMemo<PermissionGroup[]>(
      () => {
        // visibleGroups — קבוצות.
        const visibleGroups = permissionGroups
          .map((group) => ({ ...group, permissions: group.permissions.filter((permission) => visiblePermissionKeySet.has(permission.key)) }))
          .filter((group) => group.permissions.length > 0);

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !normalizedSearchTerm.
        if (!normalizedSearchTerm) {
          return visibleGroups;
        }

        return visibleGroups
          .map((group) => {
            // groupMatches — קבוצה.
            const groupMatches =
              normalizeSearchValue(
                `${group.title} ${group.description}`,
              ).includes(
                normalizedSearchTerm,
              );

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר groupMatches.
            if (groupMatches) {
              return group;
            }

            // matchingPermissions — הרשאות.
            const matchingPermissions =
              group.permissions.filter(
                (permission) =>
                  normalizeSearchValue(
                    `${permission.label} ${permission.description}`,
                  ).includes(
                    normalizedSearchTerm,
                  ),
              );

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר matchingPermissions.length === 0.
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
      [normalizedSearchTerm, visiblePermissionKeySet],
    );

  /**
   * פעולה handlePermissionChange: טיפול באירוע עבור פונקציית דיווח על שינוי.
   * @param permission — הרשאות.
   * @param isSelected — נבחר.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handlePermissionChange = (
    permission: PermissionKey,
    isSelected: boolean,
  ): void => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isDisabled.
    if (isDisabled) {
      return;
    }

    // nextPermissionSet — הרשאות / קבוצה ייחודית; אוסף ערכים ייחודיים.
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

    // hiddenSelected — נבחר.
    const hiddenSelected = selectedPermissions.filter((permission) => !visiblePermissionKeySet.has(permission));
    // nextVisible — הנתון nextVisible בהקשר הפעולה.
    const nextVisible = visiblePermissionKeys.filter((permission) => nextPermissionSet.has(permission));
    onChange(Array.from(new Set([...hiddenSelected, ...nextVisible])));
  };

  /**
   * פעולה handleSelectAll: טיפול באירוע עבור הנתון handleSelectAll בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleSelectAll =
    (): void => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isDisabled.
      if (isDisabled) {
        return;
      }

      // hiddenSelected — נבחר.
      const hiddenSelected = selectedPermissions.filter((permission) => !visiblePermissionKeySet.has(permission));
      onChange(Array.from(new Set([...hiddenSelected, ...visiblePermissionKeys])));
    };

  /**
   * פעולה handleClearAll: טיפול באירוע עבור הנתון handleClearAll בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleClearAll =
    (): void => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isDisabled.
      if (isDisabled) {
        return;
      }

      onChange(selectedPermissions.filter((permission) => !visiblePermissionKeySet.has(permission)));
    };

  /**
   * פעולה handleSelectGroup: טיפול באירוע עבור קבוצה.
   * @param group — קבוצה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleSelectGroup = (
    group: PermissionGroup,
  ): void => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isDisabled.
    if (isDisabled) {
      return;
    }

    // nextPermissionSet — הרשאות / קבוצה ייחודית; אוסף ערכים ייחודיים.
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

    // hiddenSelected — נבחר.
    const hiddenSelected = selectedPermissions.filter((permission) => !visiblePermissionKeySet.has(permission));
    // nextVisible — הנתון nextVisible בהקשר הפעולה.
    const nextVisible = visiblePermissionKeys.filter((permission) => nextPermissionSet.has(permission));
    onChange(Array.from(new Set([...hiddenSelected, ...nextVisible])));
  };

  /**
   * פעולה handleClearGroup: טיפול באירוע עבור קבוצה.
   * @param group — קבוצה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const handleClearGroup = (
    group: PermissionGroup,
  ): void => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isDisabled.
    if (isDisabled) {
      return;
    }

    // groupPermissionSet — קבוצה / הרשאות / קבוצה ייחודית; אוסף ערכים ייחודיים.
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

  // selectedVisibleCount — נבחר / כמות.
  const selectedVisibleCount = visiblePermissionKeys.filter((permission) => selectedPermissionSet.has(permission)).length;

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
              {title}
            </strong>

            <span>
              נבחרו {visiblePermissionKeys.filter((permission) => selectedPermissionSet.has(permission)).length} מתוך{' '}
              {visiblePermissionKeys.length}{' '}
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
              selectedVisibleCount === 0
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
              selectedVisibleCount ===
                visiblePermissionKeys.length
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
              // selectedGroupCount — נבחר / קבוצה / כמות.
              const selectedGroupCount =
                group.permissions.filter(
                  (permission) =>
                    selectedPermissionSet.has(
                      permission.key,
                    ),
                ).length;

              // isEntireGroupSelected — קבוצה / נבחר.
              const isEntireGroupSelected =
                selectedGroupCount ===
                group.permissions.length;

              // isOpen — האם המצב פתוח.
              const isOpen =
                Boolean(
                  normalizedSearchTerm,
                ) ||
                openGroups.has(
                  group.id,
                );

              /**
               * פעולה toggleGroup: החלפת בחירה עבור קבוצה.
               * @returns void — הפלט בהתאם לחתימה.
               */
              const toggleGroup =
                (): void => {
                  setOpenGroups(
                    (currentGroups) => {
                      // nextGroups — קבוצות; אוסף ערכים ייחודיים.
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
                          // isSelected — נבחר.
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