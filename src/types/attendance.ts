/**
 * קובץ: src/types/attendance.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור נוכחות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AttendanceRoleWorkspace, AttendanceStatisticsRow.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * חוזה הנתונים AttendanceRoleWorkspace: נוכחות.
 */
export interface AttendanceRoleWorkspace {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  canClock: boolean;
  // config — תצורה.
  config: {
    // enabled — האם האפשרות מופעלת.
    enabled: boolean;
    requireLocation: boolean;
    // workplaceName — שם.
    workplaceName: string;
    latitude: number | null;
    longitude: number | null;
    radiusMeters: number;
    // outsidePolicy — מדיניות.
    outsidePolicy: 'flag' | 'block';
    allowUnscheduled: boolean;
  };
  // openSession — סשן.
  openSession: null | { id: string; clockInAt: string; clockInDistanceM: number | null; clockInWithinRadius: boolean | null };
  // currentAssignment — הקצאה.
  currentAssignment: null | { id: string; shiftDate: string; shiftName: string; startTime: string; endTime: string };
}
/**
 * חוזה הנתונים AttendanceStatisticsRow: נוכחות / סטטיסטיקה / שורה.
 */
export interface AttendanceStatisticsRow {
  // id — מזהה.
  id:string; userId:string; displayName:string; scheduleName:string|null; workDate:string;
  clockInAt:string; clockInLat:number|null; clockInLng:number|null; clockInDistanceM:number|null; clockInWithinRadius:boolean|null;
  clockOutAt:string|null; clockOutLat:number|null; clockOutLng:number|null; clockOutDistanceM:number|null; clockOutWithinRadius:boolean|null;
  clockInEdited:boolean; clockOutEdited:boolean; missingExit:boolean; archived:boolean; canEdit:boolean;
  // workedHours — שעות.
  workedHours:number|null; hourlyRate:number|null; wage:number|null;
}
