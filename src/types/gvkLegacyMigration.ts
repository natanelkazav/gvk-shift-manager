export type GvkLegacySourceKind = 'dispatcher' | 'on_call' | 'morning_driver';

export interface GvkLegacyMigrationMappings {
  dispatcher: string;
  on_call: string;
  morning_driver: string;
}

export interface GvkLegacyMigrationTarget {
  id: string;
  name: string;
  code: string;
  strategy: string;
}

export interface GvkLegacyMigrationAreaSummary {
  members: number;
  historicalPeriods: number;
  livePeriods: number;
  liveAssignments: number;
}

export interface GvkLegacyMigrationIssue {
  code: string;
  message: string;
}

export interface GvkLegacyMigrationPreview {
  adapter: 'gvk_legacy_v1';
  ready: boolean;
  blockers: GvkLegacyMigrationIssue[];
  warnings: GvkLegacyMigrationIssue[];
  targets: {
    dispatcher: GvkLegacyMigrationTarget | null;
    onCall: GvkLegacyMigrationTarget | null;
    morningDriver: GvkLegacyMigrationTarget | null;
  };
  legacy: {
    dispatcher: GvkLegacyMigrationAreaSummary;
    onCall: GvkLegacyMigrationAreaSummary;
    morningDriver: GvkLegacyMigrationAreaSummary;
  };
}

export interface GvkLegacyMigrationResult {
  runId: string;
  membersAdded: number;
  history: Record<string, unknown>;
  livePeriodsAdded: number;
  liveAssignmentsAdded: number;
  legacyDataDeleted: false;
  cutoverEnabled: false;
  message: string;
}
