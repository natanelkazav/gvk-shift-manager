
export type StatisticsPersonType =
  | 'dispatchers'
  | 'drivers'
  | 'morning_drivers';

export interface StatisticsPersonOption {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  userType: StatisticsPersonType;
}

export interface StatisticsFilters {
  years: number[];
  months: number[];
}

export interface StatisticsSummary {
  dispatcherCount: number;
  driverCount: number;
  totalDispatcherShifts: number;
  totalDriverDuties: number;
  premiumShifts: number;
  regularShifts: number;
  nightShifts: number;
  holidayShifts: number;
  weekendShifts: number;
  weekdayDriverDuties: number;
  weekendDriverDuties: number;
  holidayDriverDuties: number;
}

export interface DispatcherStatisticsRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  totalShifts: number;
  premiumShifts: number;
  regularShifts: number;
  weekdayShifts: number;
  fridayShifts: number;
  saturdayShifts: number;
  holidayShifts: number;
  nightShifts: number;
  importedShifts: number;
}

export interface DriverStatisticsRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  totalDuties: number;
  weekdayDuties: number;
  fridayDuties: number;
  saturdayDuties: number;
  weekendDuties: number;
  holidayDuties: number;
  importedDuties: number;
}


export interface MorningDriverStatisticsRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  totalShifts: number;
  morningShifts: number;
  afternoonShifts: number;
  eveningShifts: number;
  fridayShifts: number;
  weekendShifts: number;
}

export interface MorningDriverMonthlyBreakdownRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  year: number;
  month: number;
  totalShifts: number;
}

export interface MonthlyStatisticsRow {
  year: number;
  month: number;
  dispatcherShiftCount: number;
  driverDutyCount: number;
  dispatcherPeriodStatus: string | null;
  driverPeriodStatus: string | null;
}

export interface DispatcherMonthlyBreakdownRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  year: number;
  month: number;
  totalShifts: number;
  premiumShifts: number;
  regularShifts: number;
  weekdayShifts: number;
  fridayShifts: number;
  saturdayShifts: number;
  holidayShifts: number;
  nightShifts: number;
}

export interface DriverMonthlyBreakdownRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  year: number;
  month: number;
  totalDuties: number;
  weekdayDuties: number;
  fridayDuties: number;
  saturdayDuties: number;
  weekendDuties: number;
  holidayDuties: number;
}


export type DispatcherAvailabilitySubmissionSource =
  | 'manual'
  | 'auto_partial'
  | 'auto_no_submission';

export interface DispatcherAvailabilityStatisticsSummary {
  periodCount: number;
  dispatcherCount: number;
  manualSubmissionPeriods: number;
  autoPartialPeriods: number;
  noSubmissionPeriods: number;
  declaredAvailableCount: number;
  declaredUnavailableCount: number;
  autoCompletedAvailableCount: number;
  fridayMorningAvailableCount: number;
  nightAvailableCount: number;
  premiumAvailableCount: number;
  holidayAvailableCount: number;
}

export interface DispatcherAvailabilityStatisticsRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  periodCount: number;
  manualSubmissionPeriods: number;
  autoPartialPeriods: number;
  noSubmissionPeriods: number;
  declaredAvailableCount: number;
  declaredUnavailableCount: number;
  autoCompletedAvailableCount: number;
  declaredAvailabilityRate: number;
  fridayMorningAvailableCount: number;
  fridayAfternoonAvailableCount: number;
  fridayNightAvailableCount: number;
  saturdayMorningAvailableCount: number;
  saturdayAfternoonAvailableCount: number;
  saturdayNightAvailableCount: number;
  nightAvailableCount: number;
  premiumAvailableCount: number;
  holidayAvailableCount: number;
  weekendAvailableCount: number;
}

export interface DispatcherAvailabilityMonthlyRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  year: number;
  month: number;
  submissionSource: DispatcherAvailabilitySubmissionSource;
  declaredAvailableCount: number;
  declaredUnavailableCount: number;
  autoCompletedAvailableCount: number;
  fridayMorningAvailableCount: number;
  nightAvailableCount: number;
  premiumAvailableCount: number;
}

export interface StatisticsDashboardResponse {
  filters: StatisticsFilters;
  summary: StatisticsSummary;
  dispatcherStatistics: DispatcherStatisticsRow[];
  driverStatistics: DriverStatisticsRow[];
  morningDriverStatistics: MorningDriverStatisticsRow[];
  monthlyStatistics: MonthlyStatisticsRow[];
  dispatcherMonthlyBreakdown: DispatcherMonthlyBreakdownRow[];
  driverMonthlyBreakdown: DriverMonthlyBreakdownRow[];
  morningDriverMonthlyBreakdown: MorningDriverMonthlyBreakdownRow[];
  dispatcherAvailabilitySummary: DispatcherAvailabilityStatisticsSummary;
  dispatcherAvailabilityStatistics: DispatcherAvailabilityStatisticsRow[];
  dispatcherAvailabilityMonthlyBreakdown: DispatcherAvailabilityMonthlyRow[];
  generatedAt: string;
}

export interface StatisticsDashboardRequest {
  years: number[];
  months: number[];
}

export interface StatisticsSinglePeriodRequest {
  year: number | null;
  month: number | null;
}

export interface DispatcherPayrollRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  hourlyRate: number | null;
  scheduledHours: number;
  premiumHours: number;
  projectedPay: number | null;
}

export interface DriverPayrollRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  dailyDutyRate: number | null;
  totalDuties: number;
  projectedPay: number | null;
}


export interface MorningDriverPayrollRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  hourlyRate: number | null;
  scheduledHours: number;
  projectedPay: number | null;
}

export interface PayrollStatisticsResponse {
  dispatchers: DispatcherPayrollRow[];
  drivers: DriverPayrollRow[];
  morningDrivers: MorningDriverPayrollRow[];
  projectedDispatcherPay: number;
  projectedDriverPay: number;
  projectedMorningDriverPay: number;
  actualPayAvailable: boolean;
  attendanceAvailable: boolean;
}
