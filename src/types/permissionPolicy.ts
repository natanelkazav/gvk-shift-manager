/**
 * קובץ: src/types/permissionPolicy.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור הרשאות / מדיניות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PermissionScopeMode, PermissionProfileDefinition, PermissionJobTypeOption, PermissionAdminCatalog, UserPermissionPolicy.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
import type { PermissionKey } from './auth';

/**
 * טיפוס PermissionScopeMode: הרשאות / מצב פעולה.
 */
export type PermissionScopeMode = 'all' | 'selected';

/**
 * חוזה הנתונים PermissionProfileDefinition: פרופיל הרשאות.
 */
export interface PermissionProfileDefinition {
  // id — מזהה.
  id: string;
  code: string;
  // name — שם.
  name: string;
  description: string;
  // permissions — הרשאות.
  permissions: PermissionKey[];
  isSystem: boolean;
}

/**
 * חוזה הנתונים PermissionJobTypeOption: סוג תפקיד.
 */
export interface PermissionJobTypeOption {
  // id — מזהה.
  id: string;
  // name — שם.
  name: string;
  code: string;
}

/**
 * חוזה הנתונים PermissionAdminCatalog: הרשאות.
 */
export interface PermissionAdminCatalog {
  // profiles — פרופילים.
  profiles: PermissionProfileDefinition[];
  // jobTypes — סוגי תפקידים.
  jobTypes: PermissionJobTypeOption[];
}

/**
 * חוזה הנתונים UserPermissionPolicy: משתמש / הרשאות / מדיניות.
 */
export interface UserPermissionPolicy {
  // profileCode — פרופיל.
  profileCode: string | null;
  // scopeMode — מצב פעולה.
  scopeMode: PermissionScopeMode;
  // jobTypeIds — מזהה סוג התפקיד.
  jobTypeIds: string[];
}
