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

export interface StatisticsDashboardResponse {
  filters: StatisticsFilters;
  summary: StatisticsSummary;
  dispatcherStatistics: DispatcherStatisticsRow[];
  driverStatistics: DriverStatisticsRow[];
  monthlyStatistics: MonthlyStatisticsRow[];
  dispatcherMonthlyBreakdown: DispatcherMonthlyBreakdownRow[];
  driverMonthlyBreakdown: DriverMonthlyBreakdownRow[];
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

export interface PayrollStatisticsResponse {
  dispatchers: DispatcherPayrollRow[];
  drivers: DriverPayrollRow[];
  projectedDispatcherPay: number;
  projectedDriverPay: number;
  actualPayAvailable: boolean;
  attendanceAvailable: boolean;
}
