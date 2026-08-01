export interface SchedulingEngineWeights {
  totalShiftBalance: number;
  sameCategoryBalance: number;
  nightShiftBalance: number;
  fridayShiftBalance: number;
  saturdayShiftBalance: number;
  premiumShiftBalance: number;
  holidayShiftBalance: number;
}

export interface SchedulingEngineConfig {
  weights: SchedulingEngineWeights;

  /**
   * אוסר שיבוץ למשמרות החופפות בזמן.
   */
  preventOverlappingShifts: boolean;

  /**
   * אוסר שיבוץ למשמרות שבהן
   * שעת הסיום של אחת שווה בדיוק
   * לשעת ההתחלה של השנייה.
   *
   * לדוגמה:
   * 16:00–23:00 ואז 23:00–06:00.
   */
  preventTouchingShifts: boolean;

  /**
   * משמרת לילה בפני עצמה אינה
   * מורידה ניקוד למשמרת הערב
   * של היום הבא.
   */
  penalizeAfterNightShift: boolean;

  /**
   * משמרת עם מועמד זמין יחיד
   * מטופלת לפני משמרות אחרות.
   */
  prioritizeSingleCandidateShifts:
    boolean;
}

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