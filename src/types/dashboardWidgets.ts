export type DashboardStaffingTimeScope = 'current' | 'today';

export interface DashboardWidgetJobType {
  id: string;
  name: string;
  workMode: 'shifts' | 'on_call_hourly' | 'on_call_daily';
}

export interface DashboardWidgetPreference {
  id?: string;
  widgetType: 'staffing';
  timeScope: DashboardStaffingTimeScope;
  jobTypeId: string;
  sortOrder?: number;
  enabled?: boolean;
}

export interface DashboardWidgetSettings {
  canConfigure: boolean;
  jobTypes: DashboardWidgetJobType[];
  widgets: DashboardWidgetPreference[];
}

export interface DashboardStaffingAssignment {
  assignmentId: string;
  userId: string;
  displayName: string;
  shiftDate: string;
  shiftName: string;
  startTime: string;
  endTime: string;
}

export interface ManagerDashboardStaffingWidget {
  id: string;
  timeScope: DashboardStaffingTimeScope;
  jobTypeId: string;
  jobTypeName: string;
  workMode: DashboardWidgetJobType['workMode'];
  assignments: DashboardStaffingAssignment[];
}
