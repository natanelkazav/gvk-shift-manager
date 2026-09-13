export interface DynamicCutoverState {
  dynamicFirstEnabled: boolean;
  hasDynamicMembership: boolean;
  useDynamicRuntime: boolean;
  legacyFrozen: boolean;
}

export interface LegacyFreezeReadiness {
  ready: boolean;
  dynamicFirstEnabled: boolean;
  missingLegacyMemberships: number;
  missingUsers: Array<{
    userId: string;
    displayName: string;
    legacyRole: string;
  }>;
}
