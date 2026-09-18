export interface DynamicStatisticsJobTypeOption {
  jobTypeId: string;
  name: string;
  code: string;
  isActive: boolean;
  payModel: string;
  workMode: string | null;
  availabilityEnabled: boolean;
  memberCount: number;
  dataPeriodCount: number;
  payrollEnabled: boolean;
  attendanceEnabled: boolean;
}

export interface DynamicStatisticsPersonRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  isActive: boolean;
  isMember: boolean;
  assignmentCount: number;
  timedHours: number;
  monthsWorked: number;
  managerEditedCount: number;
  substitutionCount: number;
}

export interface DynamicStatisticsMonthlyRow {
  year: number;
  month: number;
  assignmentCount: number;
  timedHours: number;
  uniqueWorkerCount: number;
  intentionallyUnassignedCount: number;
}

export interface DynamicStatisticsShiftRow {
  shiftCode: string;
  shiftName: string;
  timeLabel: string;
  assignmentCount: number;
  timedHours: number;
}

export interface DynamicStatisticsPayrollPersonRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  assignmentCount: number;
  timedHours: number;
  workDayCount: number;
  hourlyRate: number | null;
  dailyDutyRate: number | null;
  shiftRate: number | null;
  compensationRate: number | null;
  projectedPay: number;
}

export interface DynamicStatisticsAvailabilityPersonRow {
  userId: string;
  displayName: string;
  scheduleName: string | null;
  isActive: boolean;
  submittedPeriods: number;
  availableCount: number;
  unavailableCount: number;
  preferredCount: number;
  avoidCount: number;
  totalEntries: number;
}

export interface DynamicStatisticsSummary {
  assignmentCount: number;
  timedAssignmentCount: number;
  untimedAssignmentCount: number;
  timedHours: number;
  uniqueWorkerCount: number;
  monthCount: number;
  intentionallyUnassignedCount: number;
  managerEditedCount: number;
  substitutionCount: number;
}

export interface DynamicStatisticsAvailabilitySummary {
  periodCount: number;
  submissionCount: number;
  availableCount: number;
  unavailableCount: number;
  preferredCount: number;
  avoidCount: number;
}

export interface DynamicStatisticsWorkspace {
  jobType: {
    jobTypeId: string;
    name: string;
    code: string;
    payModel: string;
    workMode: string | null;
    availabilityEnabled: boolean;
    payrollEnabled: boolean;
  attendanceEnabled: boolean;
    baseRate: number;
    shiftRate: number;
  };
  filters: {
    years: number[];
    months: number[];
  };
  availablePeriods: Array<{ year: number; month: number }>;
  summary: DynamicStatisticsSummary;
  people: DynamicStatisticsPersonRow[];
  monthly: DynamicStatisticsMonthlyRow[];
  shifts: DynamicStatisticsShiftRow[];
  payrollPeople: DynamicStatisticsPayrollPersonRow[];
  payrollTotal: number;
  availabilitySummary: DynamicStatisticsAvailabilitySummary;
  availabilityPeople: DynamicStatisticsAvailabilityPersonRow[];
  generatedAt: string;
}
