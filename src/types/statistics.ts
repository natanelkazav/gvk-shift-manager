/**
 * קובץ: src/types/statistics.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור סטטיסטיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: StatisticsPersonType, StatisticsPersonOption, StatisticsFilters, StatisticsSummary, DispatcherStatisticsRow, DriverStatisticsRow, MorningDriverStatisticsRow, MorningDriverMonthlyBreakdownRow, ShiftTimeDistributionRow, MonthlyStatisticsRow ועוד.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */

/**
 * טיפוס StatisticsPersonType: סטטיסטיקה.
 */
export type StatisticsPersonType =
  | 'dispatchers'
  | 'drivers'
  | 'morning_drivers';

/**
 * חוזה הנתונים StatisticsPersonOption: סטטיסטיקה.
 */
export interface StatisticsPersonOption {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // userType — משתמש.
  userType: StatisticsPersonType;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
}

/**
 * חוזה הנתונים StatisticsFilters: סטטיסטיקה / מסננים.
 */
export interface StatisticsFilters {
  // years — שנים.
  years: number[];
  // months — חודשים.
  months: number[];
}

/**
 * חוזה הנתונים StatisticsSummary: סטטיסטיקה / סיכום.
 */
export interface StatisticsSummary {
  // dispatcherCount — מוקדנים / כמות.
  dispatcherCount: number;
  // driverCount — כוננים / כמות.
  driverCount: number;
  // totalDispatcherShifts — סך הכול / מוקדנים / משמרות.
  totalDispatcherShifts: number;
  // totalDriverDuties — סך הכול / כוננים.
  totalDriverDuties: number;
  // premiumShifts — תעריף מוגדל / משמרות.
  premiumShifts: number;
  // regularShifts — משמרות.
  regularShifts: number;
  // nightShifts — משמרות.
  nightShifts: number;
  // holidayShifts — חג / משמרות.
  holidayShifts: number;
  // weekendShifts — משמרות.
  weekendShifts: number;
  // weekdayDriverDuties — כוננים.
  weekdayDriverDuties: number;
  // weekendDriverDuties — כוננים.
  weekendDriverDuties: number;
  // holidayDriverDuties — חג / כוננים.
  holidayDriverDuties: number;
}

/**
 * חוזה הנתונים DispatcherStatisticsRow: מוקדנים / סטטיסטיקה / שורה.
 */
export interface DispatcherStatisticsRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // totalShifts — סך הכול / משמרות.
  totalShifts: number;
  // premiumShifts — תעריף מוגדל / משמרות.
  premiumShifts: number;
  // regularShifts — משמרות.
  regularShifts: number;
  // weekdayShifts — משמרות.
  weekdayShifts: number;
  // fridayShifts — משמרות.
  fridayShifts: number;
  // saturdayShifts — משמרות.
  saturdayShifts: number;
  // holidayShifts — חג / משמרות.
  holidayShifts: number;
  // nightShifts — משמרות.
  nightShifts: number;
  // importedShifts — משמרות.
  importedShifts: number;
}

/**
 * חוזה הנתונים DriverStatisticsRow: כוננים / סטטיסטיקה / שורה.
 */
export interface DriverStatisticsRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // totalDuties — סך הכול.
  totalDuties: number;
  weekdayDuties: number;
  fridayDuties: number;
  saturdayDuties: number;
  weekendDuties: number;
  // holidayDuties — חג.
  holidayDuties: number;
  importedDuties: number;
}


/**
 * חוזה הנתונים MorningDriverStatisticsRow: כונני בוקר.
 */
export interface MorningDriverStatisticsRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // totalShifts — סך הכול / משמרות.
  totalShifts: number;
  // morningShifts — משמרות.
  morningShifts: number;
  // afternoonShifts — משמרות.
  afternoonShifts: number;
  // eveningShifts — משמרות.
  eveningShifts: number;
  // fridayShifts — משמרות.
  fridayShifts: number;
  // weekendShifts — משמרות.
  weekendShifts: number;
}

/**
 * חוזה הנתונים MorningDriverMonthlyBreakdownRow: כונני בוקר.
 */
export interface MorningDriverMonthlyBreakdownRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // totalShifts — סך הכול / משמרות.
  totalShifts: number;
}


/**
 * חוזה הנתונים ShiftTimeDistributionRow: משמרת / זמן / שורה.
 */
export interface ShiftTimeDistributionRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // shiftTime — משמרת / זמן.
  shiftTime: string;
  // shiftCount — משמרת / כמות.
  shiftCount: number;
}

/**
 * חוזה הנתונים MonthlyStatisticsRow: סטטיסטיקה / שורה.
 */
export interface MonthlyStatisticsRow {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // dispatcherShiftCount — מוקדנים / משמרת / כמות.
  dispatcherShiftCount: number;
  // driverDutyCount — כוננים / כמות.
  driverDutyCount: number;
  // dispatcherPeriodStatus — מוקדנים / תקופה / סטטוס.
  dispatcherPeriodStatus: string | null;
  // driverPeriodStatus — כוננים / תקופה / סטטוס.
  driverPeriodStatus: string | null;
}

/**
 * חוזה הנתונים DispatcherMonthlyBreakdownRow: מוקדנים / שורה.
 */
export interface DispatcherMonthlyBreakdownRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // totalShifts — סך הכול / משמרות.
  totalShifts: number;
  // premiumShifts — תעריף מוגדל / משמרות.
  premiumShifts: number;
  // regularShifts — משמרות.
  regularShifts: number;
  // weekdayShifts — משמרות.
  weekdayShifts: number;
  // fridayShifts — משמרות.
  fridayShifts: number;
  // saturdayShifts — משמרות.
  saturdayShifts: number;
  // holidayShifts — חג / משמרות.
  holidayShifts: number;
  // nightShifts — משמרות.
  nightShifts: number;
}

/**
 * חוזה הנתונים DriverMonthlyBreakdownRow: כוננים / שורה.
 */
export interface DriverMonthlyBreakdownRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // totalDuties — סך הכול.
  totalDuties: number;
  weekdayDuties: number;
  fridayDuties: number;
  saturdayDuties: number;
  weekendDuties: number;
  // holidayDuties — חג.
  holidayDuties: number;
}


/**
 * טיפוס DispatcherAvailabilitySubmissionSource: מוקדנים / אילוצים וזמינות / מקור.
 */
export type DispatcherAvailabilitySubmissionSource =
  | 'manual'
  | 'auto_partial'
  | 'auto_no_submission';

/**
 * חוזה הנתונים DispatcherAvailabilityStatisticsSummary: מוקדנים / אילוצים וזמינות / סטטיסטיקה / סיכום.
 */
export interface DispatcherAvailabilityStatisticsSummary {
  // periodCount — תקופה / כמות.
  periodCount: number;
  // dispatcherCount — מוקדנים / כמות.
  dispatcherCount: number;
  // manualSubmissionPeriods — תקופות.
  manualSubmissionPeriods: number;
  // autoPartialPeriods — תקופות.
  autoPartialPeriods: number;
  // noSubmissionPeriods — תקופות.
  noSubmissionPeriods: number;
  // declaredAvailableCount — מספר הסימונים כזמין.
  declaredAvailableCount: number;
  // declaredUnavailableCount — מספר הסימונים כלא זמין.
  declaredUnavailableCount: number;
  // autoCompletedAvailableCount — מספר הסימונים כזמין.
  autoCompletedAvailableCount: number;
  // fridayMorningAvailableCount — מספר הסימונים כזמין.
  fridayMorningAvailableCount: number;
  // nightAvailableCount — מספר הסימונים כזמין.
  nightAvailableCount: number;
  // premiumAvailableCount — מספר הסימונים כזמין.
  premiumAvailableCount: number;
  // holidayAvailableCount — מספר הסימונים כזמין.
  holidayAvailableCount: number;
}

/**
 * חוזה הנתונים DispatcherAvailabilityStatisticsRow: מוקדנים / אילוצים וזמינות / סטטיסטיקה / שורה.
 */
export interface DispatcherAvailabilityStatisticsRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // periodCount — תקופה / כמות.
  periodCount: number;
  // manualSubmissionPeriods — תקופות.
  manualSubmissionPeriods: number;
  // autoPartialPeriods — תקופות.
  autoPartialPeriods: number;
  // noSubmissionPeriods — תקופות.
  noSubmissionPeriods: number;
  // declaredAvailableCount — מספר הסימונים כזמין.
  declaredAvailableCount: number;
  // declaredUnavailableCount — מספר הסימונים כלא זמין.
  declaredUnavailableCount: number;
  // autoCompletedAvailableCount — מספר הסימונים כזמין.
  autoCompletedAvailableCount: number;
  // declaredAvailabilityRate — אילוצים וזמינות.
  declaredAvailabilityRate: number;
  // fridayMorningAvailableCount — מספר הסימונים כזמין.
  fridayMorningAvailableCount: number;
  // fridayAfternoonAvailableCount — מספר הסימונים כזמין.
  fridayAfternoonAvailableCount: number;
  // fridayNightAvailableCount — מספר הסימונים כזמין.
  fridayNightAvailableCount: number;
  // saturdayMorningAvailableCount — מספר הסימונים כזמין.
  saturdayMorningAvailableCount: number;
  // saturdayAfternoonAvailableCount — מספר הסימונים כזמין.
  saturdayAfternoonAvailableCount: number;
  // saturdayNightAvailableCount — מספר הסימונים כזמין.
  saturdayNightAvailableCount: number;
  // nightAvailableCount — מספר הסימונים כזמין.
  nightAvailableCount: number;
  // premiumAvailableCount — מספר הסימונים כזמין.
  premiumAvailableCount: number;
  // holidayAvailableCount — מספר הסימונים כזמין.
  holidayAvailableCount: number;
  // weekendAvailableCount — מספר הסימונים כזמין.
  weekendAvailableCount: number;
}

/**
 * חוזה הנתונים DispatcherAvailabilityMonthlyRow: מוקדנים / אילוצים וזמינות / שורה.
 */
export interface DispatcherAvailabilityMonthlyRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // submissionSource — מקור.
  submissionSource: DispatcherAvailabilitySubmissionSource;
  // declaredAvailableCount — מספר הסימונים כזמין.
  declaredAvailableCount: number;
  // declaredUnavailableCount — מספר הסימונים כלא זמין.
  declaredUnavailableCount: number;
  // autoCompletedAvailableCount — מספר הסימונים כזמין.
  autoCompletedAvailableCount: number;
  // fridayMorningAvailableCount — מספר הסימונים כזמין.
  fridayMorningAvailableCount: number;
  // nightAvailableCount — מספר הסימונים כזמין.
  nightAvailableCount: number;
  // premiumAvailableCount — מספר הסימונים כזמין.
  premiumAvailableCount: number;
}

/**
 * חוזה הנתונים StatisticsDashboardResponse: סטטיסטיקה / לוח בקרה / תוצאת הפעולה.
 */
export interface StatisticsDashboardResponse {
  // filters — מסננים.
  filters: StatisticsFilters;
  // summary — סיכום.
  summary: StatisticsSummary;
  // dispatcherStatistics — מוקדנים / סטטיסטיקה.
  dispatcherStatistics: DispatcherStatisticsRow[];
  // driverStatistics — כוננים / סטטיסטיקה.
  driverStatistics: DriverStatisticsRow[];
  // morningDriverStatistics — כונני בוקר.
  morningDriverStatistics: MorningDriverStatisticsRow[];
  // monthlyStatistics — סטטיסטיקה.
  monthlyStatistics: MonthlyStatisticsRow[];
  // dispatcherMonthlyBreakdown — מוקדנים.
  dispatcherMonthlyBreakdown: DispatcherMonthlyBreakdownRow[];
  // driverMonthlyBreakdown — כוננים.
  driverMonthlyBreakdown: DriverMonthlyBreakdownRow[];
  // morningDriverMonthlyBreakdown — כונני בוקר.
  morningDriverMonthlyBreakdown: MorningDriverMonthlyBreakdownRow[];
  // dispatcherShiftTimeDistribution — מוקדנים / משמרת / זמן.
  dispatcherShiftTimeDistribution: ShiftTimeDistributionRow[];
  // morningDriverShiftTimeDistribution — כונני בוקר.
  morningDriverShiftTimeDistribution: ShiftTimeDistributionRow[];
  // dispatcherAvailabilitySummary — מוקדנים / אילוצים וזמינות / סיכום.
  dispatcherAvailabilitySummary: DispatcherAvailabilityStatisticsSummary;
  // dispatcherAvailabilityStatistics — מוקדנים / אילוצים וזמינות / סטטיסטיקה.
  dispatcherAvailabilityStatistics: DispatcherAvailabilityStatisticsRow[];
  // dispatcherAvailabilityMonthlyBreakdown — מוקדנים / אילוצים וזמינות.
  dispatcherAvailabilityMonthlyBreakdown: DispatcherAvailabilityMonthlyRow[];
  generatedAt: string;
}

/**
 * חוזה הנתונים StatisticsDashboardRequest: סטטיסטיקה / לוח בקרה / נתוני הבקשה.
 */
export interface StatisticsDashboardRequest {
  // years — שנים.
  years: number[];
  // months — חודשים.
  months: number[];
}

/**
 * חוזה הנתונים StatisticsSinglePeriodRequest: סטטיסטיקה / תקופה / נתוני הבקשה.
 */
export interface StatisticsSinglePeriodRequest {
  // year — שנה.
  year: number | null;
  // month — חודש.
  month: number | null;
}

/**
 * חוזה הנתונים DispatcherPayrollRow: מוקדנים / חישובי שכר / שורה.
 */
export interface DispatcherPayrollRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  hourlyRate: number | null;
  // scheduledHours — שעות.
  scheduledHours: number;
  // premiumHours — תעריף מוגדל / שעות.
  premiumHours: number;
  projectedPay: number | null;
}

/**
 * חוזה הנתונים DriverPayrollRow: כוננים / חישובי שכר / שורה.
 */
export interface DriverPayrollRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  dailyDutyRate: number | null;
  // totalDuties — סך הכול.
  totalDuties: number;
  projectedPay: number | null;
}


/**
 * חוזה הנתונים MorningDriverPayrollRow: כונני בוקר.
 */
export interface MorningDriverPayrollRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // shiftRate — משמרת.
  shiftRate: number | null;
  // totalShifts — סך הכול / משמרות.
  totalShifts: number;
  projectedPay: number | null;
}

/**
 * חוזה הנתונים PayrollStatisticsResponse: חישובי שכר / סטטיסטיקה / תוצאת הפעולה.
 */
export interface PayrollStatisticsResponse {
  dispatchers: DispatcherPayrollRow[];
  drivers: DriverPayrollRow[];
  // morningDrivers — כונני בוקר.
  morningDrivers: MorningDriverPayrollRow[];
  // projectedDispatcherPay — מוקדנים.
  projectedDispatcherPay: number;
  // projectedDriverPay — כוננים.
  projectedDriverPay: number;
  // projectedMorningDriverPay — כונני בוקר.
  projectedMorningDriverPay: number;
  actualPayAvailable: boolean;
  // attendanceAvailable — נוכחות.
  attendanceAvailable: boolean;
}
