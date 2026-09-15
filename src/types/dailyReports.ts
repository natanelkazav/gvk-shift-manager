export interface DailyReportOption {
  id: string;
  name: string;
}

export interface DailyReportSummary {
  id: string;
  reportDate?: string;
  status: 'draft' | 'submitted';
  submittedAt: string | null;
  itemCount: number;
}

export interface DailyReportRoleWorkspace {
  jobTypeId: string;
  jobTypeName: string;
  allowAddSubjects: boolean;
  allowAddCustomers: boolean;
  allowAttachments: boolean;
  subjects: DailyReportOption[];
  todayReport: DailyReportSummary | null;
  recentReports: DailyReportSummary[];
}

export interface DailyReportWorkspace {
  today: string;
  customers: DailyReportOption[];
  roles: DailyReportRoleWorkspace[];
}

export interface DailyReportItemInput {
  subjectId: string | null;
  subjectName: string;
  customerId: string | null;
  customerName: string | null;
  details: string;
}

export interface DailyReportDetailItem {
  id: string;
  subjectName: string;
  customerName: string | null;
  details: string;
  sortOrder: number;
}

export interface DailyReportDetail {
  id: string;
  reportDate: string;
  submittedAt: string;
  jobTypeId: string;
  jobTypeName: string;
  userId: string;
  displayName: string;
  items: DailyReportDetailItem[];
}

export interface DailyReportAdminUser {
  userId: string;
  displayName: string;
  email: string;
}

export interface DailyReportAdminOptions {
  users: DailyReportAdminUser[];
}

export interface DailyReportAttachment {
  id: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number;
  storagePath: string;
}
