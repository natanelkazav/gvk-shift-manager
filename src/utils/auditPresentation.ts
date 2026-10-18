import type { AuditLogEntry } from '../types/audit';
import { auditActionLabel, effectiveAuditAction } from './auditCatalog';

const fieldLabels: Record<string, string> = {
  user_id: 'עובד', userId: 'עובד', new_user_id: 'עובד חדש', old_user_id: 'עובד קודם',
  job_type_id: 'תפקיד', jobTypeId: 'תפקיד', job_type_name: 'שם התפקיד', jobTypeName: 'שם התפקיד',
  job_type_code: 'קוד תפקיד', shift_date: 'תאריך המשמרת', shiftDate: 'תאריך המשמרת',
  shift_code: 'סוג משמרת', shiftCode: 'סוג משמרת', slot_id: 'מזהה משמרת',
  assignment_id: 'מזהה שיבוץ', publication_id: 'מזהה לוח',
  employmentScope: 'היקף העסקה', employment_scope: 'היקף העסקה', is_member: 'שיוך לתפקיד', part_time_definition: 'הגדרת משרה חלקית',
  reason: 'סיבה', intentionally_unassigned: 'סימון כלא מאוישת',
  can_edit_all: 'הרשאת עריכה כללית', can_self_edit: 'הרשאת עריכה עצמית',
  month: 'חודש', year: 'שנה', rebuilt_slots: 'משמרות שנבנו מחדש',
  reset_submissions: 'הגשות אילוצים שאופסו',
  email: 'דוא״ל', display_name: 'שם', full_name: 'שם מלא',
  is_active: 'משתמש פעיל', active: 'פעיל', enabled: 'מופעל',
  start_time: 'שעת התחלה', end_time: 'שעת סיום',
  created_at: 'תאריך יצירה', updated_at: 'תאריך עדכון',
  recipientEmail: 'נמען', fileName: 'שם קובץ',
  subject: 'נושא', source: 'מקור', swap_type: 'סוג חילוף',
  shiftTemplates: 'משמרות', dayRules: 'כללי ימים', name: 'שם', code: 'קוד',
  dayKind: 'סוג יום', startTime: 'שעת התחלה', endTime: 'שעת סיום',
  minWorkers: 'מינימום עובדים', requiredWorkers: 'עובדים נדרשים', targetWorkers: 'יעד עובדים',
  maxWorkers: 'מקסימום עובדים', sortOrder: 'סדר הצגה', paySegments: 'מקטעי שכר',
  multiplier: 'מכפיל שכר', behavior: 'התנהגות ביום', inheritDayKind: 'ירושה מסוג יום',
  schedule_group_name: 'שם מערך המשמרות',
  description: 'תיאור התפקיד', availabilityConfig: 'הגדרות אילוצים', showEmployeePreferences: 'הצגת העדפות עובדים',
  effective_month: 'חודש תחולה', is_future: 'שינוי עתידי', previous_job_type_name: 'שם התפקיד לפני השינוי',
  limits: 'מגבלות', monthlyCapacity: 'מכסת משמרות חודשית',
  days: 'ימי עבודה',
  audit_context: 'צילום מצב האירוע', shift_name: 'שם המשמרת', old_user_id_name: 'העובד הקודם', new_user_id_name: 'העובד החדש', user_id_name: 'שם העובד', userId_name: 'שם העובד', target_user_id_name: 'שם העובד',
};
const valueLabels: Record<string, string> = {
  weekday: 'יום חול', friday: 'יום שישי', saturday: 'שבת',
  holiday_eve: 'ערב חג', holiday_full: 'חג', holiday_end: 'מוצאי חג',
  chol_hamoed: 'חול המועד', custom: 'מותאם אישית',
  own_templates: 'משמרות ייעודיות', inherit: 'לפי יום אחר', no_work: 'ללא עבודה',
  full_time: 'משרה מלאה', part_time: 'משרה חלקית', flexible: 'גמיש', as_much_as_possible: 'כמה שיותר',
  one_way: 'חילוף חד־צדדי', two_way: 'חילוף הדדי',
  friday_1: 'משמרת יום שישי 1', saturday_1: 'משמרת שבת 1', weekday_1: 'משמרת חול 1', saturday_daily_on_call: 'כוננות שבת (יום שלם)',
  oncall_new: 'בדיקה כוננים חדש',
};
const technicalKeys = new Set(['slot_id','assignment_id','publication_id','job_type_id','jobTypeId','user_id','userId','old_user_id','new_user_id','emailId']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function auditFieldLabel(key: string): string {
  return fieldLabels[key] ?? key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g,' ');
}
export function auditIsTechnical(key: string, value: unknown): boolean {
  return technicalKeys.has(key) || (typeof value === 'string' && uuidPattern.test(value));
}
export function auditValue(value: unknown, _key = ''): string {
  if (_key === 'part_time_definition' && value && typeof value === 'object' && !Array.isArray(value)) {
    const definition = value as Record<string, unknown>;
    const days = Array.isArray(definition.days) ? definition.days : [];
    const labels = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
    const rendered = days.map(day => typeof day === 'number' && labels[day] ? labels[day] : String(day));
    const parts = [`ימי עבודה: ${rendered.length ? rendered.join(', ') : 'לא נבחרו'}`];
    if (typeof definition.startTime === 'string') parts.push(`משעה: ${definition.startTime}`);
    if (typeof definition.endTime === 'string') parts.push(`עד שעה: ${definition.endTime}`);
    return parts.join(' · ');
  }

  if (value === null || value === undefined || value === '') return 'לא צוין';
  if (typeof value === 'string' && /(?:startTime|endTime|start_time|end_time)$/.test(_key) && /^\\d{2}:\\d{2}/.test(value)) return value.slice(0,5);
  if (typeof value === 'boolean') return value ? 'כן' : 'לא';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (valueLabels[value]) return valueLabels[value];
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-'); return `${day}.${month}.${year}`;
    }
    if (uuidPattern.test(value)) return `מזהה: ${value.slice(0,8)}…`;
    return value;
  }
  if (Array.isArray(value)) return value.map(item => auditValue(item)).join(', ');
  if (typeof value === 'object') return Object.entries(value)
    .filter(([key]) => !['id','created_at','updated_at','schedule_group_id'].includes(key))
    .map(([k,v]) => `${auditFieldLabel(k)}: ${auditValue(v,k)}`).join(' · ');
  return String(value);
}
export interface AuditChange { key: string; label: string; before?: unknown; after?: unknown; kind: 'changed'|'added'|'removed'; }
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Display nested configuration changes individually instead of printing entire JSON objects. */
function auditNestedChanges(before: Record<string, unknown>, after: Record<string, unknown>, prefix = ''): AuditChange[] {
  const result: AuditChange[] = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const previous = before[key];
    const next = after[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (isRecord(previous) && isRecord(next)) {
      result.push(...auditNestedChanges(previous, next, path));
    } else if (JSON.stringify(previous) !== JSON.stringify(next)) {
      const isDefaultAddition = path === 'availabilityConfig.showEmployeePreferences' && previous === undefined && next === true;
      result.push({
        key: path,
        label: `${auditFieldLabel(key)}${isDefaultAddition ? ' (השלמת ברירת מחדל)' : ''}`,
        before: previous,
        after: next,
        kind: !(key in before) ? 'added' : !(key in after) ? 'removed' : 'changed',
      });
    }
  }
  return result;
}

function shiftStructureChanges(before: Record<string, unknown>, after: Record<string, unknown>): AuditChange[] {
  const changes: AuditChange[] = [];
  const collections = new Set(['shiftTemplates', 'dayRules']);
  const names = (item: Record<string, unknown>, fallback: string) =>
    String(item.name ?? item.code ?? item.dayKind ?? fallback);
  for (const collection of collections) {
    if (!(collection in before) && !(collection in after)) continue;
    const oldItems = Array.isArray(before[collection]) ? before[collection] as unknown[] : [];
    const newItems = Array.isArray(after[collection]) ? after[collection] as unknown[] : [];
    const keyFor = (item: unknown, index: number) => {
      if (!isRecord(item)) return String(index);
      return String(item.code ?? item.dayKind ?? index);
    };
    const oldMap = new Map(oldItems.map((item,index)=>[keyFor(item,index),item]));
    const newMap = new Map(newItems.map((item,index)=>[keyFor(item,index),item]));
    for (const id of new Set([...oldMap.keys(),...newMap.keys()])) {
      const oldItem = oldMap.get(id), newItem = newMap.get(id);
      const item = isRecord(newItem) ? newItem : isRecord(oldItem) ? oldItem : {};
      const label = collection === 'shiftTemplates' ? 'משמרת' : 'כלל יום';
      const prefix = `${label} „${names(item,id)}”`;
      if (oldItem === undefined || newItem === undefined) {
        changes.push({key:`${collection}.${id}`,label:prefix,before:oldItem,after:newItem,
          kind:oldItem === undefined ? 'added':'removed'});
      } else if (isRecord(oldItem) && isRecord(newItem)) {
        for (const change of auditNestedChanges(oldItem,newItem)) {
          if (['id','updated_at','created_at','schedule_group_id'].includes(change.key)) continue;
          changes.push({...change,key:`${collection}.${id}.${change.key}`,
            label:`${prefix} — ${change.label}`});
        }
      } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
        changes.push({key:`${collection}.${id}`,label:prefix,before:oldItem,after:newItem,kind:'changed'});
      }
    }
  }
  const restBefore=Object.fromEntries(Object.entries(before).filter(([key])=>!collections.has(key)));
  const restAfter=Object.fromEntries(Object.entries(after).filter(([key])=>!collections.has(key)));
  return [...auditNestedChanges(restBefore,restAfter),...changes];
}

export function auditChanges(entry: AuditLogEntry): AuditChange[] {
  const before = entry.oldValues ?? {};
  const after = entry.newValues ?? {};
  if (entry.action === 'schedule_group.configuration.updated') {
    return shiftStructureChanges(before, after);
  }
  if (/^(dynamic_job_type\.(created|updated)|schedule_group\.)/.test(entry.action)) {
    return auditNestedChanges(before, after);
  }
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map(key => ({key,label:auditFieldLabel(key),before:before[key],after:after[key],kind:!(key in before)?'added' as const:!(key in after)?'removed' as const:'changed' as const}));
}
export function auditReadableSummary(entry: AuditLogEntry): string {
  const action = effectiveAuditAction(entry);
  const context = (entry.metadata?.audit_context ?? {}) as Record<string, unknown>;
  const data = {...(entry.metadata ?? {}), ...(entry.newValues ?? {}), ...context};
  const role = typeof data.job_type_name === 'string' ? ` בתפקיד „${data.job_type_name}”` : '';
  const previousEmployee = typeof context.previous_employee_name === 'string' ? context.previous_employee_name : typeof context.old_user_id_name === 'string' ? context.old_user_id_name : '';
  const nextEmployee = typeof context.new_employee_name === 'string' ? context.new_employee_name : typeof context.new_user_id_name === 'string' ? context.new_user_id_name : '';
  const employeeChange = previousEmployee && nextEmployee ? `: ${previousEmployee} הוחלף/ה ב־${nextEmployee}` : '';
  const shiftDate = typeof data.shift_date === 'string' ? auditValue(data.shift_date) : '';
  const shiftCode = typeof data.shift_name === 'string' ? data.shift_name : typeof data.shift_code === 'string' ? auditValue(data.shift_code) : '';
  const shift = [shiftCode, shiftDate].filter(Boolean).join(' בתאריך ');
  if (action === 'schedule.assignment.unassigned' && shift) return `${shift}${role} סומנה כלא מאוישת.`;
  if (action === 'schedule.assignment.filled' && shift) return `${shift}${role} אוישה.`;
  if (/^schedule\.assignment\./.test(action) && shift) return `בוצע שינוי בשיבוץ ${shift}${role}${employeeChange}.`;
  if (action === 'dynamic_job_type.deleted' && typeof data.job_type_name === 'string') return `התפקיד „${data.job_type_name}” נמחק.`;
  if (action === 'dynamic_job_type.member.saved' || action === 'dynamic_job_type.member.removed') {
    const person = typeof context.member_name === 'string' ? context.member_name : 'עובד ששמו לא נשמר';
    const job = typeof context.job_type_name === 'string' ? ` לתפקיד „${context.job_type_name}”` : ' לתפקיד';
    if (action === 'dynamic_job_type.member.removed') return `${person} הוסר/ה${job.replace(" לתפקיד", " מהתפקיד")}.`;
    if (entry.oldValues?.is_member === false) return `${person} צורף/ה${job}.`;
    const oldScope = entry.oldValues?.employment_scope;
    const newScope = entry.newValues?.employment_scope;
    if (oldScope !== newScope) return `היקף ההעסקה של ${person}${job} השתנה מ${auditValue(oldScope)} ל${auditValue(newScope)}.`;
    return `הגדרות ההעסקה של ${person}${job} עודכנו.`;
  }
  if (role && /^availability\./.test(action)) return `${entry.summary?.trim() || auditActionLabel(action)}${role}.`;
  return entry.summary?.trim() || auditActionLabel(action);
}
export function auditActorName(entry: AuditLogEntry): string {
  if (entry.actorDisplayName?.trim()) return entry.actorDisplayName;
  if (entry.actorEmail?.trim()) return entry.actorEmail;
  if (entry.actorUserId) return 'מבצע לא מזוהה';
  if (/^(schedule\.archive\.auto_sent|availability\.period\.weekend_priority_fixed)$/.test(effectiveAuditAction(entry))) return 'מערכת';
  return 'מבצע לא ידוע';
}

// Names in audit_context are immutable snapshots. Do not infer historic names from current assignments.
export function auditAssignmentChange(entry: AuditLogEntry): { before: string; after: string; changed: boolean } | null {
  if (!/^schedule\.assignment\./.test(effectiveAuditAction(entry))) return null;
  const beforeId = entry.oldValues?.user_id ?? entry.oldValues?.old_user_id;
  const afterId = entry.newValues?.user_id ?? entry.newValues?.new_user_id;
  if (beforeId === undefined && afterId === undefined) return null;
  const snapshot = entry.metadata?.audit_context;
  const ctx: Record<string, unknown> = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? snapshot as Record<string, unknown> : {};
  const name = (key: string): string | null => typeof ctx[key] === 'string' && String(ctx[key]).trim() ? String(ctx[key]) : null;
  const before = beforeId == null ? 'לא מאוישת' : name('previous_employee_name') ?? name('old_user_id_name') ?? 'שם העובד הקודם לא נשמר';
  const after = afterId == null ? 'לא מאוישת' : name('new_employee_name') ?? name('new_user_id_name') ?? (afterId === beforeId ? name('user_id_name') : null) ?? 'שם העובד החדש לא נשמר';
  return { before, after, changed: beforeId !== afterId };
}
