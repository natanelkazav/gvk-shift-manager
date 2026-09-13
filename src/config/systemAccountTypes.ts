import type { UserRole } from '../types/auth';

export type SystemAccountType = 'employee' | 'manager' | 'admin' | 'viewer';

export const SYSTEM_ACCOUNT_LABELS: Record<SystemAccountType, string> = {
  employee: 'עובד',
  manager: 'מנהל',
  admin: 'מנהל מערכת',
  viewer: 'צפייה בלבד',
};

export const SYSTEM_ACCOUNT_DESCRIPTIONS: Record<SystemAccountType, string> = {
  employee: 'גישה אישית. תפקידי העבודה וההרשאות נגזרים מה־Job Types שאליהם המשתמש משויך.',
  manager: 'גישה ניהולית מערכתית. ניהול בפועל של שיבוצים נקבע לפי Job Types שבהם המשתמש מוגדר כמנהל.',
  admin: 'גישה מערכתית מלאה, בנוסף לברירות המחדל הדינמיות של כל התפקידים.',
  viewer: 'גישה לצפייה בלבד ללא פעולות ניהול.',
};

export function accountTypeFromLegacyRole(role: UserRole): SystemAccountType {
  if (role === 'admin') return 'admin';
  if (role === 'manager') return 'manager';
  if (role === 'viewer') return 'viewer';
  return 'employee';
}

export function legacyRoleForAccountType(
  accountType: SystemAccountType,
  currentRole?: UserRole,
): UserRole {
  if (accountType === 'admin') return 'admin';
  if (accountType === 'manager') return 'manager';
  if (accountType === 'viewer') return 'viewer';

  if (currentRole && ['dispatcher', 'on_call', 'morning_driver'].includes(currentRole)) {
    return currentRole;
  }

  // Compatibility only until the legacy role enum is retired.
  return 'dispatcher';
}
