export type DynamicPilotQaStatus = 'pass' | 'warn' | 'fail';

export interface DynamicPilotQaCheck {
  code: string;
  status: DynamicPilotQaStatus;
  area: string;
  title: string;
  message: string;
  count: number;
}

export interface GvkQaReconciliationRow {
  source: 'dispatcher' | 'on_call' | 'morning_driver';
  year: number;
  month: number;
  legacyCount: number;
  dynamicAssignedCount: number;
  dynamicUnassignedCount: number;
  coveredCount: number;
  matches: boolean;
}

export interface DynamicPilotQaReport {
  generatedAt: string;
  readyForFullQa: boolean;
  summary: {
    passes: number;
    warnings: number;
    failures: number;
    dynamicFirstEnabled: boolean;
    activeJobTypes: number;
    activeMemberships: number;
    dynamicUsers: number;
    publications: number;
    assignments: number;
    pendingExchanges: number;
  };
  checks: DynamicPilotQaCheck[];
  gvkReconciliation: GvkQaReconciliationRow[];
}
