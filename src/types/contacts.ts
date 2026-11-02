/**
 * קובץ: src/types/contacts.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור אנשי קשר.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ContactChangeStatus, ContactRecord, EmployeeContact, ContactImportRow, ContactImportResult, ContactChangeSummary.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס ContactChangeStatus: איש קשר / סטטוס.
 */
export type ContactChangeStatus = 'current' | 'new' | 'updated' | 'needs_review';
/**
 * חוזה הנתונים ContactRecord: איש קשר.
 */
export interface ContactRecord { id:string; clientId:string; clientName:string; branchName:string|null; roleName:string; fullName:string; phone:string|null; email:string|null; changeStatus:ContactChangeStatus; isActive:boolean; updatedAt:string; }
/**
 * חוזה הנתונים EmployeeContact: איש קשר.
 */
export interface EmployeeContact { id:string; displayName:string; scheduleName:string|null; roleLabel:string; phone:string|null; }
/**
 * חוזה הנתונים ContactImportRow: איש קשר / ייבוא / שורה.
 */
export interface ContactImportRow { branchName:string|null; roleName:string; fullName:string; phone:string|null; email:string|null; sourceRow:number; needsReview:boolean; }
/**
 * חוזה הנתונים ContactImportResult: איש קשר / ייבוא / תוצאה.
 */
export interface ContactImportResult { imported:number; added:number; updated:number; unchanged:number; needsReview:number; affectedBranches:string[]; }
/**
 * חוזה הנתונים ContactChangeSummary: איש קשר / סיכום.
 */
export interface ContactChangeSummary { id:string; clientName:string; branchName:string|null; roleName:string; fullName:string; changeType:string; createdAt:string; }
