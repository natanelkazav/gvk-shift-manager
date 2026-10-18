import { auditActorName, auditAssignmentChange, auditChanges, auditFieldLabel, auditIsTechnical, auditReadableSummary, auditValue } from '../utils/auditPresentation';
import { auditCategories, auditActionCategory, auditActionLabel, effectiveAuditAction } from '../utils/auditCatalog';
import {
  ChevronDown,
  ChevronUp,
  FileClock,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  Fragment,
  useState,
} from 'react';
import {
  Button,
  Input,
  PageHeader,
} from '../components/ui';
import { useAuditLogs } from '../hooks/useAuditLogs';
import type {
  AuditLogEntry,
  AuditLogFilters,
} from '../types/audit';
import '../styles/audit.css';

const initialFilters:
  AuditLogFilters = {
    searchTerm: '',
    action: 'all',
    category: 'all',
    timeRange: '30d',
    dateFrom: '',
    dateTo: '',
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

function auditMemberTargetName(entry: AuditLogEntry): string {
  if (entry.targetDisplayName) return entry.targetDisplayName;
  const rawContext = entry.metadata?.audit_context;
  if (rawContext && typeof rawContext === 'object' && !Array.isArray(rawContext)) {
    const context = rawContext as Record<string, unknown>;
    if (typeof context.member_name === 'string' && context.member_name.trim()) {
      return context.member_name;
    }
  }
  return 'ללא יעד';
}

function AuditDetails({ entry }: { entry: AuditLogEntry }) {
  const assignment = auditAssignmentChange(entry);
  const jobConfiguration = /^dynamic_job_type\.(created|updated)$/.test(entry.action);
  const shiftStructure = entry.action === 'schedule_group.configuration.updated';
  const membership = entry.action === 'dynamic_job_type.member.saved' || entry.action === 'dynamic_job_type.member.removed';
  const changes = auditChanges(entry).filter(change =>
    !auditIsTechnical(change.key, change.after ?? change.before) &&
    !(assignment && (change.key === 'user_id' || change.key === 'old_user_id' || change.key === 'new_user_id')) &&
    !(membership && (change.key === 'is_member' || change.key === 'employment_scope'))
  );
  const snapshot = entry.metadata?.audit_context;
  const context = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot as Record<string, unknown> : {};
  const contextNames = new Set(['previous_employee_name','new_employee_name','old_user_id_name','new_user_id_name','user_id_name','userId_name','job_type_name','shift_name','member_name','member_user_id','previous_employment_scope','new_employment_scope']);
  const assignmentDetailsShown = new Set(['shift_date', 'shift_code', 'shiftCode', 'job_type_name', 'job_type_id', 'jobTypeId', 'shift_name','member_name','member_user_id','previous_employment_scope','new_employment_scope']);
  const details = [...Object.entries(context), ...Object.entries(entry.metadata ?? {}).filter(([key]) => key !== 'audit_context' && !(key in context))]
    .filter(([key,value]) => !contextNames.has(key) && !auditIsTechnical(key,value) && !(assignment && assignmentDetailsShown.has(key)) && !(membership && (key === 'employmentScope' || key === 'employment_scope')) && !(jobConfiguration && ['is_future','effective_month','job_type_name','previous_job_type_name'].includes(key)) &&
      !(shiftStructure && key === 'schedule_group_name'));
  const technical = [
    ...Object.entries(entry.metadata ?? {}).filter(([key,value]) => auditIsTechnical(key,value)),
    ...Object.entries(entry.oldValues ?? {}).filter(([key,value]) => auditIsTechnical(key,value)).map(([key,value]) => [`קודם: ${key}`,value] as [string,unknown]),
    ...Object.entries(entry.newValues ?? {}).filter(([key,value]) => auditIsTechnical(key,value)).map(([key,value]) => [`חדש: ${key}`,value] as [string,unknown]),
  ];
  const jobName = typeof context.job_type_name === 'string' ? context.job_type_name : null;
  const scheduleGroupName = typeof entry.metadata?.schedule_group_name === 'string'
    ? entry.metadata.schedule_group_name : null;
  const shiftName = typeof context.shift_name === 'string' ? context.shift_name : typeof entry.metadata?.shift_code === 'string' ? auditValue(entry.metadata.shift_code) : null;
  const shiftDate = typeof entry.metadata?.shift_date === 'string' ? auditValue(entry.metadata.shift_date) : null;
  const oldScope = entry.oldValues?.employment_scope;
  const newScope = entry.newValues?.employment_scope;
  const membershipBefore = entry.oldValues?.is_member === false ? 'לא משויך/ת' : entry.oldValues?.is_member === true ? auditValue(oldScope ?? 'משויך/ת') : 'לא נשמר';
  const membershipAfter = entry.newValues?.is_member === false ? 'הוסר/ה מהתפקיד' : entry.newValues?.is_member === true ? auditValue(newScope ?? 'משויך/ת') : 'לא נשמר';
  const effectiveMonth = entry.metadata?.effective_month;
  const isFuture = entry.metadata?.is_future === true;
  return <div className="audit-readable-details" dir="rtl">
    {jobConfiguration && <section className="audit-readable-card audit-job-context-card">
      <h4>פרטי התפקיד</h4>
      <dl>
        {jobName && <div className="audit-change-line"><dt>תפקיד</dt><dd>{jobName}</dd></div>}
        {typeof effectiveMonth === 'string' && <div className="audit-change-line"><dt>חודש תחולה</dt><dd>{auditValue(effectiveMonth)}</dd></div>}
        <div className="audit-change-line"><dt>תחולה</dt><dd>{isFuture ? 'שינוי לחודש עתידי' : 'שינוי לחודש הנוכחי'}</dd></div>
      </dl>
    </section>}
    {shiftStructure && <section className="audit-readable-card audit-job-context-card">
      <h4>מבנה המשמרות</h4>
      <dl>
        {scheduleGroupName && <div className="audit-change-line"><dt>מערך</dt><dd>{scheduleGroupName}</dd></div>}
        <div className="audit-change-line"><dt>סוג פעולה</dt><dd>עדכון מבנה משמרות וכללי ימים</dd></div>
      </dl>
    </section>}
    {membership && <section className="audit-readable-card audit-assignment-card">
      <h4>פרטי שינוי השיוך לתפקיד</h4>
      <dl>
        {typeof context.member_name === 'string' && <div className="audit-change-line"><dt>עובד/ת</dt><dd>{context.member_name}</dd></div>}
        {typeof context.job_type_name === 'string' && <div className="audit-change-line"><dt>תפקיד</dt><dd>{context.job_type_name}</dd></div>}
      </dl>
      {entry.oldValues?.is_member !== undefined && <div className="audit-before-after">
        <div><span>לפני השינוי</span><strong>{membershipBefore}</strong></div>
        <div><span>אחרי השינוי</span><strong>{membershipAfter}</strong></div>
      </div>}
    </section>}
    {assignment && <section className="audit-readable-card audit-assignment-card">
      <h4>פרטי שינוי השיבוץ</h4>
      <dl>
        {jobName && <div className="audit-change-line"><dt>תפקיד</dt><dd>{jobName}</dd></div>}
        {shiftDate && <div className="audit-change-line"><dt>תאריך המשמרת</dt><dd>{shiftDate}</dd></div>}
        {shiftName && <div className="audit-change-line"><dt>משמרת</dt><dd>{shiftName}</dd></div>}
      </dl>
      {assignment.changed ? <div className="audit-before-after">
        <div><span>לפני השינוי</span><strong>{assignment.before}</strong></div>
        <div><span>אחרי השינוי</span><strong>{assignment.after}</strong></div>
      </div> : <p className="audit-no-details">זהות העובד המשובץ לא השתנתה באירוע זה.</p>}
    </section>}
    {changes.length > 0 && <section className="audit-readable-card"><h4>מה השתנה?</h4>
      <dl>{changes.map(change => <div className="audit-change-line" key={change.key}>
        <dt>{change.label}</dt><dd>{change.kind === 'changed' || (jobConfiguration && change.kind === 'added') ? (
          <div className="audit-change-before-after">
            <div><small>לפני</small><span>{change.before === undefined ? 'לא הוגדר קודם' : auditValue(change.before,change.key)}</span></div>
            <div><small>אחרי</small><strong>{auditValue(change.after,change.key)}</strong></div>
          </div>
        ) : <strong>{change.kind === 'removed' ? 'הוסר' : auditValue(change.after,change.key)}</strong>}</dd>
      </div>)}</dl>
    </section>}
    {details.length > 0 && <section className="audit-readable-card"><h4>פרטים נוספים</h4><dl>{details.map(([key,value]) => <div className="audit-change-line" key={key}><dt>{auditFieldLabel(key)}</dt><dd>{auditValue(value,key)}</dd></div>)}</dl></section>}
    {!assignment && changes.length === 0 && details.length === 0 && <p className="audit-no-details">לא נשמרו פרטים נוספים שניתן להציג באופן ברור.</p>}
    <details className="audit-technical"><summary>פרטים טכניים</summary><div><strong>מזהה אירוע:</strong> <code dir="ltr">{entry.id}</code></div>
      {technical.map(([key,value],index) => <div key={`${key}-${index}`}><strong>{key}:</strong> <code dir="ltr">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</code></div>)}
      <details><summary>נתוני אירוע מקוריים (JSON)</summary><pre dir="ltr">{JSON.stringify({oldValues:entry.oldValues,newValues:entry.newValues,metadata:entry.metadata},null,2)}</pre></details>
    </details>
  </div>;
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
          <span>קטגוריה</span>
          <select value={filters.category} onChange={(event) => {
            setFilters(current => ({ ...current, category: event.target.value, action: 'all' }));
          }}>
            <option value="all">כל הקטגוריות</option>
            {Object.entries(auditCategories).filter(([key]) =>
              auditLogsState.entries.some(entry =>
                auditActionCategory(effectiveAuditAction(entry), entry.entityType) === key
              )
            ).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="audit-filter-field">
          <span>סוג פעולה</span>
          <select value={filters.action} onChange={(event) => {
            setFilters(current => ({ ...current, action: event.target.value }));
          }}>
            <option value="all">כל סוגי הפעולות</option>
            {Array.from(new Set(auditLogsState.entries
              .filter(entry => filters.category === 'all' ||
                auditActionCategory(effectiveAuditAction(entry), entry.entityType) === filters.category)
              .map(entry => effectiveAuditAction(entry))))
              .sort((a,b) => auditActionLabel(a).localeCompare(auditActionLabel(b),'he'))
              .map(action => <option key={action} value={action}>{auditActionLabel(action)}</option>)}
          </select>
        </label>

        <label className="audit-filter-field">
          <span>טווח זמן</span>

          <select
            value={filters.timeRange}
            onChange={(event) => {
              setFilters(
                (currentFilters) => ({
                  ...currentFilters,

                  timeRange:
                    event.target
                      .value as
                      AuditLogFilters[
                        'timeRange'
                      ],
                }),
              );
            }}
          >
            <option value="today">
              היום
            </option>

            <option value="7d">
              7 ימים אחרונים
            </option>

            <option value="30d">
              30 ימים אחרונים
            </option>

            <option value="all">
              כל התקופה
            </option>

            <option value="custom">
              טווח מותאם
            </option>
          </select>
        </label>

        {filters.timeRange ===
        'custom' ? (
          <>
            <label className="audit-filter-field">
              <span>מתאריך</span>

              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => {
                  setFilters(
                    (currentFilters) => ({
                      ...currentFilters,

                      dateFrom:
                        event.target.value,
                    }),
                  );
                }}
              />
            </label>

            <label className="audit-filter-field">
              <span>עד תאריך</span>

              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => {
                  setFilters(
                    (currentFilters) => ({
                      ...currentFilters,

                      dateTo:
                        event.target.value,
                    }),
                  );
                }}
              />
            </label>
          </>
        ) : null}
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
                    <Fragment key={entry.id}>
                      <tr>
                        <td>
                          {formatDate(
                            entry.createdAt,
                          )}
                        </td>

                        <td>
                          <div className="audit-person">
                            <strong>
                              {auditActorName(entry)}
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
                            className="audit-action"
                          >
                            {
                              auditActionLabel(effectiveAuditAction(entry))
                            }
                          </span>
                        </td>

                        <td>
                          <div className="audit-person">
                            <strong>
                              {auditMemberTargetName(entry)}
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
                          {auditReadableSummary(entry)}
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
                            <AuditDetails entry={entry} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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