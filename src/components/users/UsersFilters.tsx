/**
 * קובץ: src/components/users/UsersFilters.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור משתמשים / מסננים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UsersFiltersProps, UsersFilters.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { Search } from 'lucide-react';
import { Input } from '../ui';
import type { SystemAccountType } from '../../config/systemAccountTypes';
import type { UsersFilters as UsersFiltersState } from '../../types/users';

/**
 * חוזה הנתונים UsersFiltersProps: משתמשים / מסננים / מאפייני הרכיב.
 */
interface UsersFiltersProps {
  // filters — מסננים.
  filters: UsersFiltersState;
  // onChange — פונקציית דיווח על שינוי.
  onChange: (
    filters: UsersFiltersState,
  ) => void;
}

/**
 * פעולה UsersFilters: משתמשים / מסננים.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function UsersFilters({
  filters,
  onChange,
}: UsersFiltersProps) {
  /**
   * פעולה updateFilter: עדכון סינון.
   * @param key — מפתח.
   * @param value — ערך.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const updateFilter = <
    Key extends keyof UsersFiltersState,
  >(
    key: Key,
    value: UsersFiltersState[Key],
  ): void => {
    onChange({
      ...filters,
      [key]: value,
    });
  };

  return (
    <div className="users-filters">
      <Input
        id="users-search"
        label="חיפוש"
        type="search"
        value={filters.searchTerm}
        placeholder="שם, אימייל או שם שיבוץ"
        startIcon={
          <Search
            size={18}
            aria-hidden="true"
          />
        }
        onChange={(event) => {
          updateFilter(
            'searchTerm',
            event.target.value,
          );
        }}
      />

      <label className="users-filter-field">
        <span>סוג חשבון</span>

        <select
          value={filters.role}
          onChange={(event) => {
            updateFilter(
              'role',
              event.target.value as
                | SystemAccountType
                | 'all',
            );
          }}
        >
          <option value="all">
            כל סוגי החשבון
          </option>

          <option value="employee">
            עובד
          </option>

          <option value="manager">
            מנהל
          </option>

          <option value="admin">
            מנהל מערכת
          </option>

          <option value="viewer">
            צפייה בלבד
          </option>
        </select>
      </label>

      <label className="users-filter-field">
        <span>סטטוס</span>

        <select
          value={filters.status}
          onChange={(event) => {
            updateFilter(
              'status',
              event.target.value as
                UsersFiltersState['status'],
            );
          }}
        >
          <option value="all">
            כל המשתמשים
          </option>

          <option value="active">
            פעילים
          </option>

          <option value="inactive">
            מושבתים
          </option>
        </select>
      </label>
    </div>
  );
}

export default UsersFilters;