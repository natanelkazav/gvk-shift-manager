/**
 * קובץ: src/config/systemAccountTypes.ts
 * מטרה: ריכוז סוגי החשבונות והמאפיינים המערכתיים המשויכים אליהם.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SystemAccountType, accountTypeFromLegacyRole, legacyRoleForAccountType.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import type { UserRole } from '../types/auth';

/**
 * טיפוס SystemAccountType: הנתון SystemAccountType בהקשר הפעולה.
 */
export type SystemAccountType = 'employee' | 'manager' | 'admin' | 'viewer';

// SYSTEM_ACCOUNT_LABELS — הנתון SYSTEM_ACCOUNT_LABELS בהקשר הפעולה.
export const SYSTEM_ACCOUNT_LABELS: Record<SystemAccountType, string> = {
  employee: 'עובד',
  manager: 'מנהל',
  admin: 'מנהל מערכת',
  viewer: 'צפייה בלבד',
};

// SYSTEM_ACCOUNT_DESCRIPTIONS — הנתון SYSTEM_ACCOUNT_DESCRIPTIONS בהקשר הפעולה.
export const SYSTEM_ACCOUNT_DESCRIPTIONS: Record<SystemAccountType, string> = {
  employee: 'גישה אישית. תפקידי העבודה וההרשאות נגזרים מה־Job Types שאליהם המשתמש משויך.',
  manager: 'גישה ניהולית מערכתית. ניהול בפועל של שיבוצים נקבע לפי Job Types שבהם המשתמש מוגדר כמנהל.',
  admin: 'גישה מערכתית מלאה, בנוסף לברירות המחדל הדינמיות של כל התפקידים.',
  viewer: 'גישה לצפייה בלבד ללא פעולות ניהול.',
};

/**
 * פעולה accountTypeFromLegacyRole: הנתון accountTypeFromLegacyRole בהקשר הפעולה.
 * @param role — הנתון role בהקשר הפעולה.
 * @returns SystemAccountType — הפלט בהתאם לחתימה.
 */
export function accountTypeFromLegacyRole(role: UserRole): SystemAccountType {
  if (role === 'admin') return 'admin';
  if (role === 'manager') return 'manager';
  if (role === 'viewer') return 'viewer';
  return 'employee';
}

/**
 * פעולה legacyRoleForAccountType: הנתון legacyRoleForAccountType בהקשר הפעולה.
 * @param accountType — הנתון accountType בהקשר הפעולה.
 * @param currentRole — הנתון currentRole בהקשר הפעולה.
 * @returns UserRole — הפלט בהתאם לחתימה.
 */
export function legacyRoleForAccountType(
  accountType: SystemAccountType,
  currentRole?: UserRole,
): UserRole {
  if (accountType === 'admin') return 'admin';
  if (accountType === 'manager') return 'manager';
  if (accountType === 'viewer') return 'viewer';

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר currentRole && ['dispatcher', 'on_call', 'morning_driver'].includes(currentRole).
  if (currentRole && ['dispatcher', 'on_call', 'morning_driver'].includes(currentRole)) {
    return currentRole;
  }

  // Compatibility only until the legacy role enum is retired.
  return 'dispatcher';
}
