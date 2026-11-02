/**
 * קובץ: src/types/users.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור משתמשים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UsersFilters, UpdateUserProfileInput, CreateUserInput, CreateUserResponse, DeleteUserInput, DeletedUserSummary, DeleteUserResponse, UsersState, ResetUserPasswordInput, ResetUserPasswordResult ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
import type { UserProfile, UserRole } from './auth';
import type { SystemAccountType } from '../config/systemAccountTypes';

/**
 * חוזה הנתונים UsersFilters: משתמשים / מסננים.
 */
export interface UsersFilters {
  searchTerm: string;
  role: SystemAccountType | 'all';
  // status — סטטוס.
  status: 'all' | 'active' | 'inactive';
}

/**
 * חוזה הנתונים UpdateUserProfileInput: משתמש / פרופיל / קלט.
 */
export interface UpdateUserProfileInput {
  // email — כתובת דוא״ל (אופציונלי).
  email?: string;
  // displayName — שם תצוגה (אופציונלי).
  displayName?: string;
  // scheduleName — שיבוץ / שם (אופציונלי).
  scheduleName?: string | null;
  role?: UserRole;
  // isActive — האם הרשומה פעילה (אופציונלי).
  isActive?: boolean;
  // mustChangePassword — סיסמה (אופציונלי).
  mustChangePassword?: boolean;
  hourlyRate?: number | null;
  dailyDutyRate?: number | null;
  // morningShiftRate — משמרת (אופציונלי).
  morningShiftRate?: number | null;
}

/**
 * חוזה הנתונים CreateUserInput: משתמש / קלט.
 */
export interface CreateUserInput {
  // email — כתובת דוא״ל.
  email: string;
  // password — סיסמה.
  password: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  role: UserRole;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  // mustChangePassword — סיסמה.
  mustChangePassword: boolean;
}

/**
 * חוזה הנתונים CreateUserResponse: משתמש / תוצאת הפעולה.
 */
export interface CreateUserResponse {
  // user — משתמש.
  user: UserProfile;
}

/**
 * חוזה הנתונים DeleteUserInput: משתמש / קלט.
 */
export interface DeleteUserInput {
  // userId — מזהה משתמש.
  userId: string;
  reason: string | null;
}

/**
 * חוזה הנתונים DeletedUserSummary: משתמש / סיכום.
 */
export interface DeletedUserSummary {
  // id — מזהה.
  id: string;
  // email — כתובת דוא״ל.
  email: string;
  // displayName — שם תצוגה.
  displayName: string;
}

/**
 * חוזה הנתונים DeleteUserResponse: משתמש / תוצאת הפעולה.
 */
export interface DeleteUserResponse {
  success: boolean;
  // deletedUser — משתמש.
  deletedUser: DeletedUserSummary;
  // auditLogged — יומן שינויים.
  auditLogged: boolean;
}

/**
 * חוזה הנתונים UsersState: משתמשים / מצב.
 */
export interface UsersState {
  // users — משתמשים.
  users: UserProfile[];
  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;
  // error — שגיאה.
  error: string | null;
}

/**
 * חוזה הנתונים ResetUserPasswordInput: משתמש / סיסמה / קלט.
 */
export interface ResetUserPasswordInput {
  // userId — מזהה משתמש.
  userId: string;
}

/**
 * חוזה הנתונים ResetUserPasswordResult: משתמש / סיסמה / תוצאה.
 */
export interface ResetUserPasswordResult {
  // userId — מזהה משתמש.
  userId: string;
  // email — כתובת דוא״ל.
  email: string;
  // displayName — שם תצוגה.
  displayName: string;
  // emailSent — כתובת דוא״ל.
  emailSent: true;
}

/**
 * חוזה הנתונים ResetUserPasswordResponse: משתמש / סיסמה / תוצאת הפעולה.
 */
export interface ResetUserPasswordResponse {
  success: boolean;
  // user — משתמש.
  user: ResetUserPasswordResult;
  // auditLogged — יומן שינויים.
  auditLogged: boolean;
}
