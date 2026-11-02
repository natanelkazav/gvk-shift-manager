/**
 * קובץ: src/types/archive.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור ארכיון.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ArchivePeriod, ArchivePeriodsResponse, DynamicArchiveJobType, DynamicArchiveRun, DynamicArchivePeriod, DynamicArchivePeriodsResponse, UnifiedArchivePeriod.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * חוזה הנתונים ArchivePeriod: ארכיון / תקופה.
 */
export interface ArchivePeriod {
  // year — שנה.
  year: number;

  // month — חודש.
  month: number;

  // dispatcherPeriodId — מזהה התקופה.
  dispatcherPeriodId: string | null;

  // driverPeriodId — מזהה התקופה.
  driverPeriodId: string | null;

  // morningDriverPeriodId — כונני בוקר.
  morningDriverPeriodId:
    string | null;

  // dispatcherStatus — מוקדנים / סטטוס.
  dispatcherStatus: string | null;

  // driverStatus — כוננים / סטטוס.
  driverStatus: string | null;

  // morningDriverStatus — כונני בוקר.
  morningDriverStatus:
    string | null;

  // dispatcherShiftCount — מוקדנים / משמרת / כמות.
  dispatcherShiftCount: number;

  // driverDutyCount — כוננים / כמות.
  driverDutyCount: number;

  // morningDriverAssignmentCount — כונני בוקר.
  morningDriverAssignmentCount:
    number;

  // dispatcherCount — מוקדנים / כמות.
  dispatcherCount: number;

  // driverCount — כוננים / כמות.
  driverCount: number;

  // morningDriverCount — כונני בוקר.
  morningDriverCount: number;

  // dispatcherPublishedAt — מוקדנים / פורסם.
  dispatcherPublishedAt: string | null;

  // driverPublishedAt — כוננים / פורסם.
  driverPublishedAt: string | null;

  // dispatcherArchivedAt — מוקדנים.
  dispatcherArchivedAt: string | null;

  // driverArchivedAt — כוננים.
  driverArchivedAt: string | null;

  // morningDriverArchivedAt — כונני בוקר.
  morningDriverArchivedAt:
    string | null;

  // importRunId — ייבוא / מזהה.
  importRunId: string | null;

  // importFileName — ייבוא / קובץ / שם.
  importFileName: string | null;

  importedAt: string | null;

  importedBy: string | null;

  isFullyArchived: boolean;

  // hasDispatcherSchedule — מוקדנים / שיבוץ.
  hasDispatcherSchedule: boolean;

  // hasDriverSchedule — כוננים / שיבוץ.
  hasDriverSchedule: boolean;

  // hasMorningDriverSchedule — כונני בוקר.
  hasMorningDriverSchedule:
    boolean;
}

/**
 * חוזה הנתונים ArchivePeriodsResponse: ארכיון / תקופות / תוצאת הפעולה.
 */
export interface ArchivePeriodsResponse {
  // periods — תקופות.
  periods: ArchivePeriod[];

  // count — כמות.
  count: number;

  generatedAt: string;
}

/**
 * חוזה הנתונים DynamicArchiveJobType: סוג תפקיד.
 */
export interface DynamicArchiveJobType {
  // publicationId — מזהה.
  publicationId: string;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // status — סטטוס.
  status: 'published' | 'archived';
  // assignmentCount — הקצאה / כמות.
  assignmentCount: number;
  // workerCount — כמות.
  workerCount: number;
  // attendanceSessionCount — נוכחות / סשן / כמות.
  attendanceSessionCount: number;
  // attendanceMissingExitCount — נוכחות / כמות.
  attendanceMissingExitCount: number;
  // publishedAt — פורסם.
  publishedAt: string | null;
  archivedAt: string | null;
}

/**
 * חוזה הנתונים DynamicArchiveRun: דינמי / ארכיון.
 */
export interface DynamicArchiveRun {
  // id — מזהה.
  id: string;
  // status — סטטוס.
  status: 'sent';
  // fileName — קובץ / שם.
  fileName: string | null;
  // emailId — כתובת דוא״ל / מזהה.
  emailId: string | null;
  sentAt: string | null;
  // attemptCount — כמות.
  attemptCount: number;
}

/**
 * חוזה הנתונים DynamicArchivePeriod: דינמי / ארכיון / תקופה.
 */
export interface DynamicArchivePeriod {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  isFullyArchived: boolean;
  archivedAt: string | null;
  // archiveRun — ארכיון.
  archiveRun: DynamicArchiveRun | null;
  // jobTypes — סוגי תפקידים.
  jobTypes: DynamicArchiveJobType[];
}

/**
 * חוזה הנתונים DynamicArchivePeriodsResponse: דינמי / ארכיון / תקופות / תוצאת הפעולה.
 */
export interface DynamicArchivePeriodsResponse {
  // periods — תקופות.
  periods: DynamicArchivePeriod[];
  generatedAt: string;
}

/**
 * חוזה הנתונים UnifiedArchivePeriod: ארכיון / תקופה.
 */
export interface UnifiedArchivePeriod extends ArchivePeriod {
  // dynamicJobTypes — סוגי תפקידים.
  dynamicJobTypes: DynamicArchiveJobType[];
  // dynamicArchivedAt — דינמי.
  dynamicArchivedAt: string | null;
  // hasDynamicArchive — דינמי / ארכיון.
  hasDynamicArchive: boolean;
  // archiveRun — ארכיון.
  archiveRun: DynamicArchiveRun | null;
}
