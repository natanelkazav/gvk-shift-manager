/**
 * קובץ: src/types/shiftSwap.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור החלפת משמרות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ShiftSwapType, ShiftSwapStatus, ShiftSwapShiftOption, ShiftSwapDispatcherOption, ShiftSwapCreateOptions, ShiftSwapRequest, CreateShiftSwapRequestInput, ShiftSwapMutationResult.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * טיפוס ShiftSwapType: החלפת משמרות.
 */
export type ShiftSwapType =
  | 'one_way'
  | 'two_way';

/**
 * טיפוס ShiftSwapStatus: החלפת משמרות.
 */
export type ShiftSwapStatus =
  | 'pending_counterparty'
  | 'pending_manager'
  | 'approved'
  | 'rejected_by_counterparty'
  | 'rejected_by_manager'
  | 'cancelled'
  | 'expired';

/**
 * חוזה הנתונים ShiftSwapShiftOption: החלפת משמרות.
 */
export interface ShiftSwapShiftOption {
  // id — מזהה.
  id: string;
  // periodId — מזהה התקופה.
  periodId: string;
  // assignedUserId — מזהה העובד המשובץ (אופציונלי).
  assignedUserId?: string;
  // shiftDate — תאריך המשמרת.
  shiftDate: string;
  // startsAt — מועד התחלה.
  startsAt: string;
  // endsAt — מועד סיום.
  endsAt: string;
  // shiftCode — משמרת.
  shiftCode: string;
  // scheduleType — סוג יום השיבוץ.
  scheduleType: string;
  // isPremium — תעריף מוגדל.
  isPremium: boolean;
  // holidayName — חג / שם.
  holidayName: string | null;
  // periodYear — תקופה / שנה.
  periodYear: number;
  // periodMonth — תקופה / חודש.
  periodMonth: number;
}

/**
 * חוזה הנתונים ShiftSwapDispatcherOption: החלפת משמרות.
 */
export interface ShiftSwapDispatcherOption {
  // id — מזהה.
  id: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
}

/**
 * חוזה הנתונים ShiftSwapCreateOptions: החלפת משמרות.
 */
export interface ShiftSwapCreateOptions {
  // myShifts — משמרות.
  myShifts: ShiftSwapShiftOption[];
  dispatchers: ShiftSwapDispatcherOption[];
  // counterpartyShifts — משמרות.
  counterpartyShifts: ShiftSwapShiftOption[];
}

/**
 * חוזה הנתונים ShiftSwapRequest: החלפת משמרות.
 */
export interface ShiftSwapRequest {
  // id — מזהה.
  id: string;
  swapType: ShiftSwapType;
  // status — סטטוס.
  status: ShiftSwapStatus;
  // requesterUserId — מזהה משתמש.
  requesterUserId: string;
  // requesterName — שם.
  requesterName: string;
  // counterpartyUserId — מזהה משתמש.
  counterpartyUserId: string;
  // counterpartyName — שם.
  counterpartyName: string;
  // requesterShiftId — מזהה המשמרת.
  requesterShiftId: string;
  // requesterShiftDate — תאריך המשמרת.
  requesterShiftDate: string;
  // requesterStartsAt — מועד התחלה.
  requesterStartsAt: string;
  // requesterEndsAt — מועד סיום.
  requesterEndsAt: string;
  // counterpartyShiftId — מזהה המשמרת.
  counterpartyShiftId: string | null;
  // counterpartyShiftDate — תאריך המשמרת.
  counterpartyShiftDate: string | null;
  // counterpartyStartsAt — מועד התחלה.
  counterpartyStartsAt: string | null;
  // counterpartyEndsAt — מועד סיום.
  counterpartyEndsAt: string | null;
  rejectionReason: string | null;
  counterpartyRespondedAt: string | null;
  managerReviewedAt: string | null;
  // managerUserId — מזהה משתמש.
  managerUserId: string | null;
  // createdAt — מועד יצירה.
  createdAt: string;
  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים CreateShiftSwapRequestInput: החלפת משמרות.
 */
export interface CreateShiftSwapRequestInput {
  swapType: ShiftSwapType;
  // requesterShiftId — מזהה המשמרת.
  requesterShiftId: string;
  // counterpartyUserId — מזהה משתמש.
  counterpartyUserId: string;
  // counterpartyShiftId — מזהה המשמרת (אופציונלי).
  counterpartyShiftId?: string | null;
}

/**
 * חוזה הנתונים ShiftSwapMutationResult: החלפת משמרות.
 */
export interface ShiftSwapMutationResult {
  // id — מזהה.
  id: string;
  // status — סטטוס.
  status: ShiftSwapStatus;
  swapType?: ShiftSwapType;
  // requesterUserId — מזהה משתמש (אופציונלי).
  requesterUserId?: string;
  // counterpartyUserId — מזהה משתמש (אופציונלי).
  counterpartyUserId?: string;
  // requesterShiftId — מזהה המשמרת (אופציונלי).
  requesterShiftId?: string;
  // counterpartyShiftId — מזהה המשמרת (אופציונלי).
  counterpartyShiftId?: string | null;
  // managerUserId — מזהה משתמש (אופציונלי).
  managerUserId?: string;
  // createdAt — מועד יצירה (אופציונלי).
  createdAt?: string;
  counterpartyRespondedAt?: string;
  managerReviewedAt?: string;
  cancelledAt?: string;
  // notificationIds — התראות (אופציונלי).
  notificationIds?: string[];
}
