import {
  ChevronDown,
  ChevronUp,
  FileClock,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  useState,
} from 'react';
import {
  Button,
  Input,
  PageHeader,
} from '../components/ui';
import { useAuditLogs } from '../hooks/useAuditLogs';
import type {
  AuditAction,
  AuditLogEntry,
  AuditLogFilters,
} from '../types/audit';
import '../styles/audit.css';

const initialFilters:
  AuditLogFilters = {
    searchTerm: '',
    action: 'all',
  };

const actionLabels: Record<
  AuditAction,
  string
> = {
  user_created:
    'יצירת משתמש',

  user_updated:
    'עדכון משתמש',

  user_activated:
    'הפעלת משתמש',

  user_deactivated:
    'השבתת משתמש',
  
  availability_period_opened:
  'פתיחת תקופת אילוצים',

  user_permissions_updated:
    'עדכון הרשאות',

  user_password_change_required:
    'דרישה לשינוי סיסמה',

  user_password_change_completed:
    'השלמת שינוי סיסמה',

  user_deleted:
    'מחיקת משתמש',
  availability_period_closed:
  'סגירת תקופת אילוצים',
};

function formatDate(
  dateValue: string,
): string {
  const date = new Date(dateValue);

  if (
    Number.isNaN(date.getTime())
  ) {
    return 'תאריך לא ידוע';
  }

  return new Intl.DateTimeFormat(
    'he-IL',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

function formatValue(
  value: unknown,
): string {
  if (value === null) {
    return 'ריק';
  }

  if (
    typeof value === 'boolean'
  ) {
    return value ? 'כן' : 'לא';
  }

  if (
    typeof value === 'object'
  ) {
    return JSON.stringify(
      value,
      null,
      2,
    );
  }

  return String(value);
}

function AuditValues({
  title,
  values,
}: {
  title: string;
  values:
    | Record<string, unknown>
    | null;
}) {
  if (
    !values ||
    Object.keys(values).length === 0
  ) {
    return (
      <div className="audit-values-card">
        <h4>{title}</h4>
        <p>אין מידע להצגה.</p>
      </div>
    );
  }

  return (
    <div className="audit-values-card">
      <h4>{title}</h4>

      <dl>
        {Object.entries(values).map(
          ([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>
                {formatValue(value)}
              </dd>
            </div>
          ),
        )}
      </dl>
    </div>
  );
}

function AuditLogPage() {
  const [
    filters,
    setFilters,
  ] = useState<AuditLogFilters>(
    initialFilters,
  );

  const [
    expandedEntryId,
    setExpandedEntryId,
  ] = useState<string | null>(
    null,
  );

  const {
    auditLogsState,
    filteredEntries,
    loadAuditLogs,
  } = useAuditLogs(filters);

  const toggleEntry = (
    entry: AuditLogEntry,
  ): void => {
    setExpandedEntryId(
      (currentId) =>
        currentId === entry.id
          ? null
          : entry.id,
    );
  };

  return (
    <section className="audit-page">
      <PageHeader
        title="יומן מערכת"
        description="צפייה בפעולות ניהול ובשינויים שבוצעו במערכת."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={
              auditLogsState.isLoading
            }
            onClick={() => {
              void loadAuditLogs();
            }}
          >
            <RefreshCw
              size={18}
              className={
                auditLogsState.isLoading
                  ? 'audit-loading-icon'
                  : ''
              }
              aria-hidden="true"
            />

            רענון
          </Button>
        }
      />

      <div className="audit-filters">
        <Input
          id="audit-search"
          label="חיפוש"
          type="search"
          value={filters.searchTerm}
          placeholder="חיפוש לפי מבצע, יעד או תיאור"
          startIcon={
            <Search size={18} />
          }
          onChange={(event) => {
            setFilters(
              (currentFilters) => ({
                ...currentFilters,
                searchTerm:
                  event.target.value,
              }),
            );
          }}
        />

        <label className="audit-filter-field">
          <span>סוג פעולה</span>

          <select
            value={filters.action}
            onChange={(event) => {
              setFilters(
                (currentFilters) => ({
                  ...currentFilters,

                  action:
                    event.target
                      .value as
                      | AuditAction
                      | 'all',
                }),
              );
            }}
          >
            <option value="all">
              כל הפעולות
            </option>

            {(
              Object.entries(
                actionLabels,
              ) as Array<
                [
                  AuditAction,
                  string,
                ]
              >
            ).map(
              ([
                action,
                label,
              ]) => (
                <option
                  key={action}
                  value={action}
                >
                  {label}
                </option>
              ),
            )}
          </select>
        </label>
      </div>

      {auditLogsState.error ? (
        <div
          className="audit-error"
          role="alert"
        >
          {auditLogsState.error}
        </div>
      ) : null}

      <div className="audit-summary">
        נמצאו{' '}
        <strong>
          {filteredEntries.length}
        </strong>{' '}
        פעולות
      </div>

      <div className="audit-table-container">
        {auditLogsState.isLoading ? (
          <div className="audit-empty-state">
            <RefreshCw
              size={30}
              className="audit-loading-icon"
              aria-hidden="true"
            />

            <p>
              טוען את יומן המערכת...
            </p>
          </div>
        ) : filteredEntries.length ===
          0 ? (
          <div className="audit-empty-state">
            <FileClock
              size={34}
              aria-hidden="true"
            />

            <p>
              לא נמצאו פעולות
              המתאימות לסינון.
            </p>
          </div>
        ) : (
          <table className="audit-table">
            <thead>
              <tr>
                <th>תאריך ושעה</th>
                <th>מבצע</th>
                <th>פעולה</th>
                <th>יעד</th>
                <th>תיאור</th>
                <th aria-label="פרטים" />
              </tr>
            </thead>

            <tbody>
              {filteredEntries.map(
                (entry) => {
                  const isExpanded =
                    expandedEntryId ===
                    entry.id;

                  return (
                    <>
                      <tr
                        key={entry.id}
                      >
                        <td>
                          {formatDate(
                            entry.createdAt,
                          )}
                        </td>

                        <td>
                          <div className="audit-person">
                            <strong>
                              {entry
                                .actorDisplayName ??
                                'מערכת'}
                            </strong>

                            {entry.actorEmail ? (
                              <span>
                                {
                                  entry.actorEmail
                                }
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td>
                          <span
                            className={`audit-action audit-action-${entry.action}`}
                          >
                            {
                              actionLabels[
                                entry.action
                              ]
                            }
                          </span>
                        </td>

                        <td>
                          <div className="audit-person">
                            <strong>
                              {entry
                                .targetDisplayName ??
                                'ללא יעד'}
                            </strong>

                            {entry.targetEmail ? (
                              <span>
                                {
                                  entry.targetEmail
                                }
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td>
                          {entry.summary}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="audit-expand-button"
                            aria-label={
                              isExpanded
                                ? 'סגירת פרטי הפעולה'
                                : 'פתיחת פרטי הפעולה'
                            }
                            aria-expanded={
                              isExpanded
                            }
                            onClick={() => {
                              toggleEntry(
                                entry,
                              );
                            }}
                          >
                            {isExpanded ? (
                              <ChevronUp
                                size={19}
                              />
                            ) : (
                              <ChevronDown
                                size={19}
                              />
                            )}
                          </button>
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr
                          key={`${entry.id}-details`}
                          className="audit-details-row"
                        >
                          <td colSpan={6}>
                            <div className="audit-details">
                              <AuditValues
                                title="ערכים קודמים"
                                values={
                                  entry.oldValues
                                }
                              />

                              <AuditValues
                                title="ערכים חדשים"
                                values={
                                  entry.newValues
                                }
                              />

                              <AuditValues
                                title="מידע נוסף"
                                values={
                                  entry.metadata
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                },
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default AuditLogPage;