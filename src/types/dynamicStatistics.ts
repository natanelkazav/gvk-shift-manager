/**
 * קובץ: src/types/dynamicStatistics.ts
 * מטרה: הגדרת טיפוסים וחוזי נתונים עבור דינמי / סטטיסטיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DynamicStatisticsJobTypeOption, DynamicStatisticsPersonRow, DynamicStatisticsMonthlyRow, DynamicStatisticsShiftRow, DynamicStatisticsPayrollPersonRow, DynamicStatisticsAvailabilityPersonRow, DynamicStatisticsSummary, DynamicStatisticsAvailabilitySummary, DynamicStatisticsWorkspace.
 * - תיאור מבנה הקלט והפלט לבדיקת טיפוסים בזמן פיתוח.
 */
/**
 * חוזה הנתונים DynamicStatisticsJobTypeOption: סוג תפקיד.
 */
export interface DynamicStatisticsJobTypeOption {
  // jobTypeId — מזהה סוג התפקיד.
  jobTypeId: string;
  // name — שם.
  name: string;
  code: string;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  payModel: string;
  // workMode — מצב פעולה.
  workMode: string | null;
  // availabilityEnabled — אילוצים וזמינות / האם האפשרות מופעלת.
  availabilityEnabled: boolean;
  // memberCount — כמות.
  memberCount: number;
  // dataPeriodCount — נתונים / תקופה / כמות.
  dataPeriodCount: number;
  // payrollEnabled — חישובי שכר / האם האפשרות מופעלת.
  payrollEnabled: boolean;
  // attendanceEnabled — נוכחות / האם האפשרות מופעלת.
  attendanceEnabled: boolean;
  // activityTrackingEnabled — מעקב פעילות וזמני עבודה (אופציונלי).
  activityTrackingEnabled?: boolean;
  personalOnly?: boolean;
}

/**
 * חוזה הנתונים DynamicStatisticsPersonRow: דינמי / סטטיסטיקה / שורה.
 */
export interface DynamicStatisticsPersonRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  isMember: boolean;
  // assignmentCount — הקצאה / כמות.
  assignmentCount: number;
  // timedHours — שעות.
  timedHours: number;
  // monthsWorked — חודשים.
  monthsWorked: number;
  // managerEditedCount — כמות.
  managerEditedCount: number;
  // substitutionCount — כמות.
  substitutionCount: number;
}

/**
 * חוזה הנתונים DynamicStatisticsMonthlyRow: דינמי / סטטיסטיקה / שורה.
 */
export interface DynamicStatisticsMonthlyRow {
  // year — שנה.
  year: number;
  // month — חודש.
  month: number;
  // assignmentCount — הקצאה / כמות.
  assignmentCount: number;
  // timedHours — שעות.
  timedHours: number;
  // uniqueWorkerCount — כמות.
  uniqueWorkerCount: number;
  // intentionallyUnassignedCount — כמות.
  intentionallyUnassignedCount: number;
}

/**
 * חוזה הנתונים DynamicStatisticsShiftRow: דינמי / סטטיסטיקה / משמרת / שורה.
 */
export interface DynamicStatisticsShiftRow {
  // shiftCode — משמרת.
  shiftCode: string;
  // shiftName — משמרת / שם.
  shiftName: string;
  // timeLabel — זמן / תווית.
  timeLabel: string;
  // assignmentCount — הקצאה / כמות.
  assignmentCount: number;
  // timedHours — שעות.
  timedHours: number;
}

/**
 * חוזה הנתונים DynamicStatisticsPayrollPersonRow: דינמי / סטטיסטיקה / חישובי שכר / שורה.
 */
export interface DynamicStatisticsPayrollPersonRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // assignmentCount — הקצאה / כמות.
  assignmentCount: number;
  // timedHours — שעות.
  timedHours: number;
  // workDayCount — יום / כמות.
  workDayCount: number;
  hourlyRate: number | null;
  dailyDutyRate: number | null;
  // shiftRate — משמרת.
  shiftRate: number | null;
  compensationRate: number | null;
  projectedPay: number;
}

/**
 * חוזה הנתונים DynamicStatisticsAvailabilityPersonRow: דינמי / סטטיסטיקה / אילוצים וזמינות / שורה.
 */
export interface DynamicStatisticsAvailabilityPersonRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // scheduleName — שיבוץ / שם.
  scheduleName: string | null;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  // submittedPeriods — הוגש / תקופות.
  submittedPeriods: number;
  // availableCount — מספר הסימונים כזמין.
  availableCount: number;
  // unavailableCount — מספר הסימונים כלא זמין.
  unavailableCount: number;
  // preferredCount — כמות.
  preferredCount: number;
  // avoidCount — כמות.
  avoidCount: number;
  // totalEntries — סך הכול / רשומות.
  totalEntries: number;
}

/**
 * חוזה הנתונים DynamicStatisticsSummary: דינמי / סטטיסטיקה / סיכום.
 */
export interface DynamicStatisticsSummary {
  // assignmentCount — הקצאה / כמות.
  assignmentCount: number;
  // timedAssignmentCount — הקצאה / כמות.
  timedAssignmentCount: number;
  // untimedAssignmentCount — הקצאה / כמות.
  untimedAssignmentCount: number;
  // timedHours — שעות.
  timedHours: number;
  // uniqueWorkerCount — כמות.
  uniqueWorkerCount: number;
  // monthCount — חודש / כמות.
  monthCount: number;
  // intentionallyUnassignedCount — כמות.
  intentionallyUnassignedCount: number;
  // managerEditedCount — כמות.
  managerEditedCount: number;
  // substitutionCount — כמות.
  substitutionCount: number;
}

/**
 * חוזה הנתונים DynamicStatisticsAvailabilitySummary: דינמי / סטטיסטיקה / אילוצים וזמינות / סיכום.
 */
export interface DynamicStatisticsAvailabilitySummary {
  // periodCount — תקופה / כמות.
  periodCount: number;
  // submissionCount — כמות.
  submissionCount: number;
  // availableCount — מספר הסימונים כזמין.
  availableCount: number;
  // unavailableCount — מספר הסימונים כלא זמין.
  unavailableCount: number;
  // preferredCount — כמות.
  preferredCount: number;
  // avoidCount — כמות.
  avoidCount: number;
}

/**
 * חוזה הנתונים DynamicStatisticsWorkspace: דינמי / סטטיסטיקה.
 */
export interface DynamicStatisticsWorkspace {
  // jobType — סוג תפקיד.
  jobType: {
    // jobTypeId — מזהה סוג התפקיד.
    jobTypeId: string;
    // name — שם.
    name: string;
    code: string;
    payModel: string;
    // workMode — מצב פעולה.
    workMode: string | null;
    // availabilityEnabled — אילוצים וזמינות / האם האפשרות מופעלת.
    availabilityEnabled: boolean;
    // payrollEnabled — חישובי שכר / האם האפשרות מופעלת.
    payrollEnabled: boolean;
  // attendanceEnabled — נוכחות / האם האפשרות מופעלת.
  attendanceEnabled: boolean;
  // activityTrackingEnabled — מעקב פעילות וזמני עבודה (אופציונלי).
  activityTrackingEnabled?: boolean;
  personalOnly?: boolean;
    baseRate: number;
    // shiftRate — משמרת.
    shiftRate: number;
  };
  // filters — מסננים.
  filters: {
    // years — שנים.
    years: number[];
    // months — חודשים.
    months: number[];
  };
  // availablePeriods — תקופות.
  availablePeriods: Array<{ year: number; month: number }>;
  // summary — סיכום.
  summary: DynamicStatisticsSummary;
  people: DynamicStatisticsPersonRow[];
  monthly: DynamicStatisticsMonthlyRow[];
  // shifts — משמרות.
  shifts: DynamicStatisticsShiftRow[];
  // payrollPeople — חישובי שכר.
  payrollPeople: DynamicStatisticsPayrollPersonRow[];
  // payrollTotal — חישובי שכר / סך הכול.
  payrollTotal: number;
  // availabilitySummary — אילוצים וזמינות / סיכום.
  availabilitySummary: DynamicStatisticsAvailabilitySummary;
  // availabilityPeople — אילוצים וזמינות.
  availabilityPeople: DynamicStatisticsAvailabilityPersonRow[];
  generatedAt: string;
}
