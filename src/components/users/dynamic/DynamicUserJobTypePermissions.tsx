import { ChevronDown, RotateCcw, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  DynamicUserJobTypePermission,
  DynamicUserJobTypePermissionEditor,
  DynamicUserJobTypePermissionSelection,
} from '../../../types/dynamicPermissionEngine';

interface DynamicUserJobTypePermissionsProps {
  editor: DynamicUserJobTypePermissionEditor;
  isDisabled?: boolean;
  onChange: (permissions: DynamicUserJobTypePermissionSelection[]) => void;
}

interface PermissionCategory {
  id: string;
  title: string;
  description: string;
  permissions: DynamicUserJobTypePermission[];
}


function buildCategories(
  permissions: DynamicUserJobTypePermission[],
  audience: 'member' | 'manager',
): PermissionCategory[] {
  const definitions = audience === 'member'
    ? [
        { id: 'availability', title: 'אילוצים', description: 'צפייה, הגשה ועריכה של האילוצים האישיים.', features: ['availability'] },
        { id: 'personal-schedule', title: 'שיבוץ אישי', description: 'צפייה בשיבוץ האישי ופעולות אישיות שמותרות בתפקיד.', features: ['schedule', 'self_edit'] },
        { id: 'shift-exchange', title: 'חילופי משמרות', description: 'בקשה ותגובה לחילופי משמרות.', features: ['shift_exchange'] },
      ]
    : [
        { id: 'schedule-workflow', title: 'ניהול מחזור שיבוץ', description: 'תקופת אילוצים, טיוטה, שיבוץ, סבב ופרסום במקום אחד.', features: ['availability', 'schedule', 'monthly_rotation'] },
        { id: 'shift-exchange-management', title: 'ניהול חילופי משמרות', description: 'צפייה, אישור ודחייה של בקשות חילוף.', features: ['shift_exchange'] },
        { id: 'statistics', title: 'סטטיסטיקות', description: 'צפייה בדוחות ובנתוני התפקיד.', features: ['statistics'] },
        { id: 'payroll', title: 'שכר', description: 'צפייה בנתוני השכר של התפקיד.', features: ['payroll'] },
      ];

  const usedKeys = new Set<string>();
  const categories = definitions.flatMap((definition) => {
    const matches = permissions.filter((permission) => definition.features.includes(permission.featureKey));
    matches.forEach((permission) => usedKeys.add(permission.permissionKey));
    return matches.length > 0 ? [{ ...definition, permissions: matches }] : [];
  });

  const uncategorized = permissions.filter((permission) => !usedKeys.has(permission.permissionKey));
  if (uncategorized.length > 0) {
    categories.push({
      id: 'other',
      title: 'הרשאות נוספות',
      description: 'יכולות נוספות שהוגדרו עבור התפקיד.',
      features: [],
      permissions: uncategorized,
    });
  }

  return categories;
}

function DynamicUserJobTypePermissions({
  editor,
  isDisabled = false,
  onChange,
}: DynamicUserJobTypePermissionsProps) {
  const [openJobTypes, setOpenJobTypes] = useState<Set<string>>(() => new Set());
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());

  const selections = useMemo(
    () => editor.jobTypes.flatMap((jobType) =>
      jobType.permissions.map((permission) => ({
        jobTypeId: jobType.jobTypeId,
        permissionKey: permission.permissionKey,
        enabled: permission.enabled,
      })),
    ),
    [editor],
  );

  const setPermission = (jobTypeId: string, permissionKey: string, enabled: boolean): void => {
    if (isDisabled) return;
    onChange(
      selections.map((item) =>
        item.jobTypeId === jobTypeId && item.permissionKey === permissionKey
          ? { ...item, enabled }
          : item,
      ),
    );
  };

  const setCategoryPermissions = (
    jobTypeId: string,
    permissions: DynamicUserJobTypePermission[],
    enabled: boolean,
  ): void => {
    if (isDisabled) return;
    const keys = new Set(permissions.map((permission) => permission.permissionKey));
    onChange(
      selections.map((item) =>
        item.jobTypeId === jobTypeId && keys.has(item.permissionKey)
          ? { ...item, enabled }
          : item,
      ),
    );
  };

  const overrideCount = editor.jobTypes.reduce(
    (total, jobType) => total + jobType.permissions.filter((permission) => permission.hasOverride).length,
    0,
  );

  const resetToDefaults = (): void => {
    if (isDisabled || overrideCount === 0) return;
    onChange(
      editor.jobTypes.flatMap((jobType) => jobType.permissions.map((permission) => ({
        jobTypeId: jobType.jobTypeId,
        permissionKey: permission.permissionKey,
        enabled: permission.inheritedEnabled,
      }))),
    );
  };

  if (editor.jobTypes.length === 0) {
    return <div className="permission-policy-note">אין כרגע סוגי תפקידים דינמיים פעילים.</div>;
  }

  return (
    <div className="dynamic-user-job-type-permissions">
      <div className="permission-policy-card-header dynamic-user-job-type-permissions-intro">
        <div>
          <strong>הרשאות לפי תפקידים דינמיים</strong>
          <span>ברירות המחדל נגזרות מסוג המשתמש ומהתפקידים שלו. שינוי ידני נשמר כהתאמה אישית בלבד.</span>
        </div>
        <div className="dynamic-permission-intro-actions">
          {overrideCount > 0 ? (
            <button type="button" className="dynamic-permission-reset-button" disabled={isDisabled} onClick={resetToDefaults}>
              <RotateCcw size={15} aria-hidden="true" />
              איפוס לברירות מחדל
            </button>
          ) : null}
          <ShieldCheck size={22} aria-hidden="true" />
        </div>
      </div>

      <div className="user-permissions-groups">
        {editor.jobTypes.map((jobType) => {
          const isOpen = openJobTypes.has(jobType.jobTypeId);
          const memberPermissions = jobType.permissions.filter((permission) => permission.audience === 'member');
          const managerPermissions = jobType.permissions.filter((permission) => permission.audience === 'manager');
          const memberCategories = buildCategories(memberPermissions, 'member');
          const managerCategories = buildCategories(managerPermissions, 'manager');
          const enabledMemberCategories = memberCategories.filter((category) => category.permissions.some((permission) => permission.enabled)).length;
          const enabledManagerCategories = managerCategories.filter((category) => category.permissions.some((permission) => permission.enabled)).length;

          const toggleOpen = (): void => {
            setOpenJobTypes((current) => {
              const next = new Set(current);
              if (next.has(jobType.jobTypeId)) next.delete(jobType.jobTypeId);
              else next.add(jobType.jobTypeId);
              return next;
            });
          };

          const renderPermission = (permission: DynamicUserJobTypePermission) => (
            <label
              key={`${jobType.jobTypeId}-${permission.permissionKey}-${permission.audience}`}
              className={[
                'user-permission-item',
                permission.enabled ? 'user-permission-item-selected' : '',
                isDisabled ? 'user-permission-item-disabled' : '',
              ].filter(Boolean).join(' ')}
            >
              <input
                type="checkbox"
                checked={permission.enabled}
                disabled={isDisabled}
                onChange={(event) => setPermission(jobType.jobTypeId, permission.permissionKey, event.target.checked)}
              />
              <span className="user-permission-switch"><span /></span>
              <span className="user-permission-content">
                <strong>{permission.label}</strong>
                <small>{permission.description}</small>
                <small className={permission.hasOverride ? 'dynamic-permission-source dynamic-permission-source-override' : 'dynamic-permission-source'}>
                  {permission.hasOverride
                    ? 'התאמה אישית'
                    : permission.defaultSource === 'system_admin'
                      ? 'ברירת מחדל: מנהל מערכת'
                      : permission.defaultSource === 'job_type_manager'
                        ? 'ברירת מחדל: מנהל התפקיד'
                        : permission.defaultSource === 'job_type_member'
                          ? `ברירת מחדל: תפקיד ${jobType.jobTypeName}`
                          : 'לא פעיל כברירת מחדל'}
                </small>
              </span>
            </label>
          );

          const renderCategory = (category: PermissionCategory) => {
            const categoryKey = `${jobType.jobTypeId}:${category.id}`;
            const categoryOpen = openCategories.has(categoryKey);
            const enabledCount = category.permissions.filter((permission) => permission.enabled).length;
            const allEnabled = enabledCount === category.permissions.length;
            const partiallyEnabled = enabledCount > 0 && !allEnabled;

            return (
              <section key={categoryKey} className={['dynamic-permission-category', categoryOpen ? 'dynamic-permission-category-open' : ''].filter(Boolean).join(' ')}>
                <div className="dynamic-permission-category-header">
                  <button
                    type="button"
                    className="dynamic-permission-category-expand"
                    aria-expanded={categoryOpen}
                    onClick={() => setOpenCategories((current) => {
                      const next = new Set(current);
                      if (next.has(categoryKey)) next.delete(categoryKey);
                      else next.add(categoryKey);
                      return next;
                    })}
                  >
                    <ChevronDown size={17} aria-hidden="true" />
                    <span>
                      <strong>{category.title}</strong>
                      <small>{category.description}</small>
                    </span>
                  </button>

                  <label className="dynamic-permission-category-control">
                    <span>{enabledCount}/{category.permissions.length}</span>
                    <input
                      type="checkbox"
                      checked={allEnabled}
                      ref={(element) => { if (element) element.indeterminate = partiallyEnabled; }}
                      disabled={isDisabled}
                      onChange={(event) => setCategoryPermissions(jobType.jobTypeId, category.permissions, event.target.checked)}
                      aria-label={`הפעלת כל הרשאות ${category.title}`}
                    />
                    <span className="user-permission-switch"><span /></span>
                  </label>
                </div>
                {categoryOpen ? <div className="user-permissions-list dynamic-permission-category-list">{category.permissions.map(renderPermission)}</div> : null}
              </section>
            );
          };

          return (
            <section
              key={jobType.jobTypeId}
              className={['user-permissions-group', 'user-permissions-group-blue', isOpen ? 'user-permissions-group-open' : ''].filter(Boolean).join(' ')}
            >
              <header className="user-permissions-group-header">
                <button type="button" className="user-permissions-group-toggle" aria-expanded={isOpen} onClick={toggleOpen}>
                  <span className="user-permissions-group-accent" aria-hidden="true" />
                  <span className="user-permissions-group-heading-text">
                    <strong>{jobType.jobTypeName}</strong>
                    <small>
                      {jobType.isMember ? 'עובד בתפקיד' : 'לא משויך כעובד'}
                      {' · '}
                      {jobType.isManager ? 'מנהל תפקיד' : 'לא מוגדר כמנהל'}
                    </small>
                  </span>
                  <ChevronDown size={18} className="user-permissions-group-chevron" aria-hidden="true" />
                </button>
                <div className="user-permissions-group-summary dynamic-permission-group-summary">
                  {memberCategories.length > 0 ? <span>{enabledMemberCategories}/{memberCategories.length} קבוצות עובד</span> : null}
                  {managerCategories.length > 0 ? <span>{enabledManagerCategories}/{managerCategories.length} קבוצות ניהול</span> : null}
                  {jobType.permissions.some((permission) => permission.hasOverride) ? <span className="dynamic-permission-override-badge">מותאם אישית</span> : null}
                </div>
              </header>

              {isOpen ? (
                <div className="dynamic-user-job-type-permission-body">
                  {memberCategories.length > 0 ? (
                    <section className="dynamic-user-job-type-permission-section">
                      <div className="dynamic-user-job-type-permission-section-heading">
                        <strong>הרשאות עובד</strong>
                        <span>פעולות אישיות של העובד, מקובצות לפי תחום.</span>
                      </div>
                      <div className="dynamic-permission-category-list-wrapper">{memberCategories.map(renderCategory)}</div>
                    </section>
                  ) : null}

                  {managerCategories.length > 0 ? (
                    <section className="dynamic-user-job-type-permission-section">
                      <div className="dynamic-user-job-type-permission-section-heading">
                        <strong>הרשאות ניהול</strong>
                        <span>ניהול מחזור השיבוץ ושאר יכולות הניהול של התפקיד.</span>
                      </div>
                      <div className="dynamic-permission-category-list-wrapper">{managerCategories.map(renderCategory)}</div>
                    </section>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default DynamicUserJobTypePermissions;
