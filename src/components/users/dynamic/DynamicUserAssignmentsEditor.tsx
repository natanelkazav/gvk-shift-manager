/**
 * קובץ: src/components/users/dynamic/DynamicUserAssignmentsEditor.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור דינמי / משתמש / הקצאות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicUserAssignmentsEditorProps, DynamicUserAssignmentsEditor.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { BriefcaseBusiness, Crown, UsersRound } from 'lucide-react';
import type { DynamicUserAssignmentSelection } from '../../../types/dynamicUserAssignments';
import type { DynamicJobType, DynamicMemberEmploymentScope } from '../../../types/dynamicScheduling';

/**
 * חוזה הנתונים DynamicUserAssignmentsEditorProps: דינמי / משתמש / הקצאות / מאפייני הרכיב.
 */
interface DynamicUserAssignmentsEditorProps {
  // jobTypes — סוגי תפקידים.
  jobTypes: DynamicJobType[];
  // assignments — הקצאות.
  assignments: DynamicUserAssignmentSelection[];
  // isDisabled — האם האפשרות מושבתת (אופציונלי).
  isDisabled?: boolean;
  // onChange — פונקציית דיווח על שינוי.
  onChange: (assignments: DynamicUserAssignmentSelection[]) => void;
}

// scopeLabels — הנתון scopeLabels בהקשר הפעולה.
const scopeLabels: Record<DynamicMemberEmploymentScope, string> = {
  full_time: 'משרה מלאה',
  part_time: 'משרה חלקית',
  as_much_as_possible: 'כמה שיותר',
};

/**
 * פעולה DynamicUserAssignmentsEditor: דינמי / משתמש / הקצאות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DynamicUserAssignmentsEditor({
  jobTypes,
  assignments,
  isDisabled = false,
  onChange,
}: DynamicUserAssignmentsEditorProps) {
  // assignmentMap — הקצאה / מפת התאמה; מיפוי לחיפוש לפי מפתח.
  const assignmentMap = new Map(assignments.map((item) => [item.jobTypeId, item]));

  /**
   * פעולה update: עדכון הנתון update בהקשר הפעולה.
   * @param jobType — סוג תפקיד.
   * @param patch — הנתון patch בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const update = (
    jobType: DynamicJobType,
    patch: Partial<DynamicUserAssignmentSelection>,
  ): void => {
    // current — הנתון current בהקשר הפעולה.
    const current = assignmentMap.get(jobType.id) ?? {
      jobTypeId: jobType.id,
      isMember: false,
      isManager: false,
      employmentScope: jobType.employmentScope === 'flexible' ? 'full_time' : jobType.employmentScope,
      partTimeDefinition: {},
    };

    // next — הנתון next בהקשר הפעולה.
    const next = {
      ...current,
      ...patch,
      jobTypeId: jobType.id,
    };

    onChange([
      ...assignments.filter((item) => item.jobTypeId !== jobType.id),
      next,
    ]);
  };

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר jobTypes.length === 0.
  if (jobTypes.length === 0) {
    return (
      <div className="dynamic-user-assignments-empty">
        עדיין לא קיימים סוגי תפקידים פעילים. צור Job Type לפני שיוך עובדים.
      </div>
    );
  }

  return (
    <div className="dynamic-user-assignments-editor">
      <div className="dynamic-user-assignments-intro">
        <BriefcaseBusiness size={20} aria-hidden="true" />
        <div>
          <strong>תפקידי עבודה וניהול</strong>
          <span>התפקידים כאן הם מקור האמת החדש. סוג החשבון קובע גישת מערכת בלבד.</span>
        </div>
      </div>

      <div className="dynamic-user-assignment-list">
        {jobTypes.filter((jobType) => jobType.isActive).map((jobType) => {
          // assignment — הקצאה.
          const assignment = assignmentMap.get(jobType.id);
          // isMember — הנתון isMember בהקשר הפעולה.
          const isMember = assignment?.isMember ?? false;
          // isManager — הנתון isManager בהקשר הפעולה.
          const isManager = assignment?.isManager ?? false;
          // selectedScope — נבחר.
          const selectedScope = assignment?.employmentScope
            ?? (jobType.employmentScope === 'flexible' ? 'full_time' : jobType.employmentScope);

          return (
            <section className="dynamic-user-assignment-card" key={jobType.id}>
              <div className="dynamic-user-assignment-heading">
                <div>
                  <strong>{jobType.name}</strong>
                  <span>{jobType.description?.trim() || 'תפקיד ומערך שיבוץ דינמי'}</span>
                </div>
                <span className="dynamic-user-assignment-strategy">{jobType.schedulingStrategy}</span>
              </div>

              <div className="dynamic-user-assignment-options">
                <label>
                  <input
                    type="checkbox"
                    checked={isMember}
                    disabled={isDisabled}
                    onChange={(event) => update(jobType, { isMember: event.target.checked })}
                  />
                  <UsersRound size={17} aria-hidden="true" />
                  <span>
                    <strong>עובד בתפקיד</strong>
                    <small>יקבל את הרשאות העובד וברירות המחדל של התפקיד.</small>
                  </span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={isManager}
                    disabled={isDisabled}
                    onChange={(event) => update(jobType, { isManager: event.target.checked })}
                  />
                  <Crown size={17} aria-hidden="true" />
                  <span>
                    <strong>מנהל התפקיד</strong>
                    <small>יוכל לנהל את מחזורי האילוצים והשיבוץ בהתאם להרשאות התפקיד.</small>
                  </span>
                </label>
              </div>

              {isMember && jobType.employmentScope === 'flexible' ? (
                <label className="dynamic-user-assignment-scope">
                  <span>היקף עבודה בתפקיד</span>
                  <select
                    value={selectedScope ?? 'full_time'}
                    disabled={isDisabled}
                    onChange={(event) => update(jobType, {
                      employmentScope: event.target.value as DynamicMemberEmploymentScope,
                    })}
                  >
                    {(Object.entries(scopeLabels) as Array<[DynamicMemberEmploymentScope, string]>).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default DynamicUserAssignmentsEditor;
