/**
 * קובץ: src/types/dynamicPermissionEngine.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור דינמי / הרשאות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicPermissionAudience, DynamicPermissionDefinition, DynamicDashboardContextPolicy, DynamicJobTypePermissionManager, DynamicJobTypePermissionEditor, DynamicUserPermissionRoleSummary, DynamicUserPermissionSummary, DynamicUserJobTypePermission, DynamicUserJobTypePermissionGroup, DynamicUserJobTypePermissionEditor ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס DynamicPermissionAudience: דינמי / הרשאות.
 */
export type DynamicPermissionAudience = 'member' | 'manager';

/**
 * חוזה הנתונים DynamicPermissionDefinition: דינמי / הרשאות.
 */
export interface DynamicPermissionDefinition {
  // permissionKey — מפתח ההרשאה.
  permissionKey: string;
  // featureKey — מפתח.
  featureKey: string;
  audience: DynamicPermissionAudience;
  // label — תווית.
  label: string;
  description: string;
  // enabled — האם האפשרות מופעלת.
  enabled: boolean;
  // defaultEnabled — האם האפשרות מופעלת.
  defaultEnabled: boolean;
}


/**
 * חוזה הנתונים DynamicDashboardContextPolicy: דינמי / לוח בקרה / מדיניות.
 */
export interface DynamicDashboardContextPolicy {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // targetJobTypeIds — מזהה סוג התפקיד היעד.
  targetJobTypeIds: string[];
}

/**
 * חוזה הנתונים DynamicJobTypePermissionManager: סוג תפקיד.
 */
export interface DynamicJobTypePermissionManager {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // email — כתובת דוא״ל.
  email: string;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  isManager: boolean;
}

/**
 * חוזה הנתונים DynamicJobTypePermissionEditor: סוג תפקיד.
 */
export interface DynamicJobTypePermissionEditor {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  // activeFeatures — פעיל.
  activeFeatures: string[];
  // memberPermissions — הרשאות.
  memberPermissions: DynamicPermissionDefinition[];
  // managerPermissions — הרשאות.
  managerPermissions: DynamicPermissionDefinition[];
  managers: DynamicJobTypePermissionManager[];
}

/**
 * חוזה הנתונים DynamicUserPermissionRoleSummary: דינמי / משתמש / הרשאות / סיכום.
 */
export interface DynamicUserPermissionRoleSummary {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  relationship: 'member' | 'manager';
  // permissions — הרשאות.
  permissions: Array<{
    // permissionKey — מפתח ההרשאה.
    permissionKey: string;
    // label — תווית.
    label: string;
    // featureKey — מפתח.
    featureKey: string;
  }>;
}

/**
 * חוזה הנתונים DynamicUserPermissionSummary: דינמי / משתמש / הרשאות / סיכום.
 */
export interface DynamicUserPermissionSummary {
  roles: DynamicUserPermissionRoleSummary[];
}

/**
 * חוזה הנתונים DynamicUserJobTypePermission: סוג תפקיד.
 */
export interface DynamicUserJobTypePermission extends DynamicPermissionDefinition {
  // inheritedEnabled — האם האפשרות מופעלת.
  inheritedEnabled: boolean;
  hasOverride: boolean;
  // defaultSource — מקור.
  defaultSource: 'system_admin' | 'job_type_manager' | 'job_type_member' | 'none';
}

/**
 * חוזה הנתונים DynamicUserJobTypePermissionGroup: סוג תפקיד.
 */
export interface DynamicUserJobTypePermissionGroup {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // jobTypeName — סוג תפקיד.
  jobTypeName: string;
  isMember: boolean;
  isManager: boolean;
  // activeFeatures — פעיל.
  activeFeatures: string[];
  // permissions — הרשאות.
  permissions: DynamicUserJobTypePermission[];
}

/**
 * חוזה הנתונים DynamicUserJobTypePermissionEditor: סוג תפקיד.
 */
export interface DynamicUserJobTypePermissionEditor {
  role?: string;
  // jobTypes — סוגי תפקידים.
  jobTypes: DynamicUserJobTypePermissionGroup[];
}

/**
 * חוזה הנתונים DynamicUserJobTypePermissionSelection: סוג תפקיד.
 */
export interface DynamicUserJobTypePermissionSelection {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // permissionKey — מפתח ההרשאה.
  permissionKey: string;
  // enabled — האם האפשרות מופעלת.
  enabled: boolean;
}
