/**
 * קובץ: src/types/auth.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור אימות משתמשים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UserRole, PermissionKey, UserProfile, AuthState, SignInCredentials.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
import type {
  Session,
  User,
} from '@supabase/supabase-js';

/**
 * טיפוס UserRole: משתמש.
 */
export type UserRole =
  | 'admin'
  | 'manager'
  | 'dispatcher'
  | 'on_call'
  | 'morning_driver'
  | 'viewer';

/**
 * טיפוס PermissionKey: מפתח ההרשאה.
 */
export type PermissionKey =
  | 'dashboard.view'

  | 'schedule.view'
  | 'schedule.view_team'
  | 'schedule.edit'

  | 'availability.view'
  | 'availability.manage'

| 'driver_availability.view'
| 'driver_availability.manage'

| 'driver_schedule.view'
| 'driver_schedule.view_team'
| 'driver_schedule.edit'
| 'driver_schedule.edit_any'

  | 'morning_driver_availability.view'
  | 'morning_driver_availability.manage'

  | 'morning_driver_schedule.view'
  | 'morning_driver_schedule.view_team'
  | 'morning_driver_schedule.edit'
  | 'morning_driver_schedule.edit_any'

  | 'notifications.view'
  | 'notifications.manage'
  | 'announcements.send'

  | 'statistics.view'

  | 'payroll.view'
  | 'payroll.manage'
  | 'attendance.view'
  | 'attendance.manage'

  | 'shift_swaps.view'
  | 'shift_swaps.approve'

  | 'archive.view'

  | 'audit.view'

  | 'users.view'
  | 'users.manage'

  | 'settings.view'
  | 'settings.manage'

  | 'schedule_import.manage'
  | 'schedule_export.manage'

  | 'contacts.view'
  | 'contacts.edit'
  | 'contacts.delete'
  | 'contacts.import'
  | 'contacts.changes_view';

/**
 * חוזה הנתונים UserProfile: משתמש / פרופיל.
 */
export interface UserProfile {
  // id — מזהה.
  id: string;
  // email — כתובת דוא״ל.
  email: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  role: UserRole;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  // mustChangePassword — סיסמה.
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  // createdAt — מועד יצירה.
  createdAt: string;
  // updatedAt — מועד עדכון.
  updatedAt: string;
  hourlyRate?: number | null;
  dailyDutyRate?: number | null;
  // morningShiftRate — משמרת (אופציונלי).
  morningShiftRate?: number | null;
}

/**
 * חוזה הנתונים AuthState: אימות משתמשים / מצב.
 */
export interface AuthState {
  // session — סשן.
  session: Session | null;
  // user — משתמש.
  user: User | null;
  // profile — פרופיל.
  profile: UserProfile | null;
  // permissions — הרשאות.
  permissions: PermissionKey[];
  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;
  // permissionsLoaded — הרשאות.
  permissionsLoaded: boolean;
  // error — שגיאה.
  error: string | null;
}

/**
 * חוזה הנתונים SignInCredentials: הנתון SignInCredentials בהקשר הפעולה.
 */
export interface SignInCredentials {
  // email — כתובת דוא״ל.
  email: string;
  // password — סיסמה.
  password: string;
  rememberMe: boolean;
}