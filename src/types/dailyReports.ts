/**
 * קובץ: src/types/dailyReports.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור דוחות פעילות יומיים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DailyReportOption, DailyReportSummary, DailyReportRoleWorkspace, DailyReportWorkspace, DailyReportItemInput, DailyReportDetailItem, DailyReportDetail, DailyReportAdminUser, DailyReportAdminOptions, DailyReportAttachment.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * חוזה הנתונים DailyReportOption: דוחות פעילות יומיים.
 */
export interface DailyReportOption {
  // id — מזהה.
  id: string;
  // name — שם.
  name: string;
}

/**
 * חוזה הנתונים DailyReportSummary: דוחות פעילות יומיים.
 */
export interface DailyReportSummary {
  // id — מזהה.
  id: string;
  // reportDate — דוח / תאריך (אופציונלי).
  reportDate?: string;
  // status — סטטוס.
  status: 'draft' | 'submitted';
  // submittedAt — הוגש.
  submittedAt: string | null;
  // itemCount — פריט / כמות.
  itemCount: number;
}

/**
 * חוזה הנתונים DailyReportRoleWorkspace: דוחות פעילות יומיים.
 */
export interface DailyReportRoleWorkspace {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  allowAddSubjects: boolean;
  allowAddCustomers: boolean;
  allowAttachments: boolean;
  subjects: DailyReportOption[];
  // todayReport — דוח.
  todayReport: DailyReportSummary | null;
  // recentReports — דוחות.
  recentReports: DailyReportSummary[];
}

/**
 * חוזה הנתונים DailyReportWorkspace: דוחות פעילות יומיים.
 */
export interface DailyReportWorkspace {
  today: string;
  customers: DailyReportOption[];
  roles: DailyReportRoleWorkspace[];
}

/**
 * חוזה הנתונים DailyReportItemInput: דוחות פעילות יומיים.
 */
export interface DailyReportItemInput {
  // subjectId — מזהה.
  subjectId: string | null;
  // subjectName — שם.
  subjectName: string;
  // customerId — מזהה.
  customerId: string | null;
  // customerName — שם.
  customerName: string | null;
  details: string;
}

/**
 * חוזה הנתונים DailyReportDetailItem: דוחות פעילות יומיים.
 */
export interface DailyReportDetailItem {
  // id — מזהה.
  id: string;
  // subjectName — שם.
  subjectName: string;
  // customerName — שם.
  customerName: string | null;
  details: string;
  // sortOrder — סדר המיון.
  sortOrder: number;
}

/**
 * חוזה הנתונים DailyReportDetail: דוחות פעילות יומיים.
 */
export interface DailyReportDetail {
  // id — מזהה.
  id: string;
  // reportDate — דוח / תאריך.
  reportDate: string;
  // submittedAt — הוגש.
  submittedAt: string;
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // items — פריטים.
  items: DailyReportDetailItem[];
  attachments: DailyReportAttachment[];
}

/**
 * חוזה הנתונים DailyReportAdminUser: דוחות פעילות יומיים.
 */
export interface DailyReportAdminUser {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // email — כתובת דוא״ל.
  email: string;
}

/**
 * חוזה הנתונים DailyReportAdminOptions: דוחות פעילות יומיים.
 */
export interface DailyReportAdminOptions {
  // users — משתמשים.
  users: DailyReportAdminUser[];
}

/**
 * חוזה הנתונים DailyReportAttachment: דוחות פעילות יומיים.
 */
export interface DailyReportAttachment {
  // id — מזהה.
  id: string;
  // fileName — קובץ / שם.
  fileName: string;
  mimeType: string | null;
  // fileSize — קובץ.
  fileSize: number;
  // storagePath — נתיב.
  storagePath: string;
}
