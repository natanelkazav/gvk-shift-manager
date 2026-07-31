import { Search } from 'lucide-react';
import { Input } from '../ui';
import type { UserRole } from '../../types/auth';
import type { UsersFilters as UsersFiltersState } from '../../types/users';

interface UsersFiltersProps {
  filters: UsersFiltersState;
  onChange: (
    filters: UsersFiltersState,
  ) => void;
}

function UsersFilters({
  filters,
  onChange,
}: UsersFiltersProps) {
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
        <span>תפקיד</span>

        <select
          value={filters.role}
          onChange={(event) => {
            updateFilter(
              'role',
              event.target.value as
                | UserRole
                | 'all',
            );
          }}
        >
          <option value="all">
            כל התפקידים
          </option>

          <option value="admin">
            מנהל מערכת
          </option>

          <option value="manager">
            מנהלת
          </option>

          <option value="dispatcher">
            מוקדן
          </option>

          <option value="on_call">
            כונן
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