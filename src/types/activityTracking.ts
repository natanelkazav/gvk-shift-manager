/**
 * קובץ: src/types/activityTracking.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור מעקב פעילות וזמני עבודה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ActivityDefinition, ActivitySegment, ActivityDay, ActivityTrackingEffectiveSettings, ActivityRoleContext, ActivityPersonalSettingsRole, ActivityWeekRow, ActivityWeek, ActivityRange, StatisticsPeriodMode.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * חוזה הנתונים ActivityDefinition: הנתון ActivityDefinition בהקשר הפעולה.
 */
export interface ActivityDefinition { key:string; label:string }
/**
 * חוזה הנתונים ActivitySegment: הנתון ActivitySegment בהקשר הפעולה.
 */
export interface ActivitySegment { id:string; activityKey:string; activityLabel:string; startedAt:string; endedAt:string|null }
/**
 * חוזה הנתונים ActivityDay: יום.
 */
export interface ActivityDay { id:string; status:'active'|'ended'|'needs_review'; workDate:string; startedAt:string; endedAt:string|null; segments:ActivitySegment[] }
/**
 * חוזה הנתונים ActivityTrackingEffectiveSettings: מעקב פעילות וזמני עבודה.
 */
export interface ActivityTrackingEffectiveSettings { autoEndEnabled:boolean; autoEndTime:string; endReminderEnabled:boolean; endReminderMinutesBefore:number; continuousReminderEnabled:boolean; continuousReminderMinutes:number }
/**
 * חוזה הנתונים ActivityRoleContext: הנתון ActivityRoleContext בהקשר הפעולה.
 */
export interface ActivityRoleContext { jobTypeId:string; jobTypeName:string; activities:ActivityDefinition[]; reminderEnabled:boolean; reminderTime:string; effectiveSettings?:ActivityTrackingEffectiveSettings; day:ActivityDay|null }
/**
 * חוזה הנתונים ActivityPersonalSettingsRole: הגדרות.
 */
export interface ActivityPersonalSettingsRole { jobTypeId:string; jobTypeName:string; defaults:ActivityTrackingEffectiveSettings; personal:{ autoEndEnabled:boolean|null; autoEndTime:string|null; endReminderEnabled:boolean|null; endReminderMinutesBefore:number|null; continuousReminderEnabled:boolean|null; continuousReminderMinutes:number|null } }
/**
 * חוזה הנתונים ActivityWeekRow: שורה.
 */
export interface ActivityWeekRow { userId:string; displayName:string; workDate:string; activityKey:string; activityLabel:string; hours:number; segmentId:string; startedAt:string; endedAt:string|null; status:string }
/**
 * חוזה הנתונים ActivityWeek: הנתון ActivityWeek בהקשר הפעולה.
 */
export interface ActivityWeek { weekStart:string; weekEnd:string; rows:ActivityWeekRow[] }
/**
 * חוזה הנתונים ActivityRange: הנתון ActivityRange בהקשר הפעולה.
 */
export interface ActivityRange { rangeStart:string; rangeEnd:string; rows:ActivityWeekRow[] }
/**
 * טיפוס StatisticsPeriodMode: סטטיסטיקה / תקופה / מצב פעולה.
 */
export type StatisticsPeriodMode='day'|'week'|'month'|'year';
