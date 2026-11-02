/**
 * קובץ: src/config/schedulingEngineConfig.ts
 * מטרה: ריכוז תצורת ברירת המחדל עבור תצורה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SchedulingEngineWeights, SchedulingEngineConfig.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
/**
 * חוזה הנתונים SchedulingEngineWeights: משקלים בחישוב.
 */
export interface SchedulingEngineWeights {
  // totalShiftBalance — סך הכול / משמרת.
  totalShiftBalance: number;
  sameCategoryBalance: number;
  // nightShiftBalance — משמרת.
  nightShiftBalance: number;
  // fridayShiftBalance — משמרת.
  fridayShiftBalance: number;
  // saturdayShiftBalance — משמרת.
  saturdayShiftBalance: number;
  // premiumShiftBalance — תעריף מוגדל / משמרת.
  premiumShiftBalance: number;
  // holidayShiftBalance — חג / משמרת.
  holidayShiftBalance: number;
}

/**
 * חוזה הנתונים SchedulingEngineConfig: תצורה.
 */
export interface SchedulingEngineConfig {
  // weights — משקלים בחישוב.
  weights: SchedulingEngineWeights;

  /**
   * אוסר שיבוץ למשמרות החופפות בזמן.
   */
  // preventOverlappingShifts — משמרות.
  preventOverlappingShifts: boolean;

  /**
   * אוסר שיבוץ למשמרות שבהן
   * שעת הסיום של אחת שווה בדיוק
   * לשעת ההתחלה של השנייה.
   *
   * לדוגמה:
   * 16:00–23:00 ואז 23:00–06:00.
   */
  // preventTouchingShifts — משמרות.
  preventTouchingShifts: boolean;

  /**
   * משמרת לילה בפני עצמה אינה
   * מורידה ניקוד למשמרת הערב
   * של היום הבא.
   */
  // penalizeAfterNightShift — משמרת.
  penalizeAfterNightShift: boolean;

  /**
   * משמרת עם מועמד זמין יחיד
   * מטופלת לפני משמרות אחרות.
   */
  // prioritizeSingleCandidateShifts — משמרות.
  prioritizeSingleCandidateShifts:
    boolean;
}

// schedulingEngineConfig — תצורה.
export const schedulingEngineConfig:
  SchedulingEngineConfig = {
    weights: {
      totalShiftBalance: 40,
      sameCategoryBalance: 18,
      nightShiftBalance: 15,
      fridayShiftBalance: 12,
      saturdayShiftBalance: 12,
      premiumShiftBalance: 10,
      holidayShiftBalance: 10,
    },

    preventOverlappingShifts: true,

    preventTouchingShifts: true,

    penalizeAfterNightShift: false,

    prioritizeSingleCandidateShifts:
      true,
  };