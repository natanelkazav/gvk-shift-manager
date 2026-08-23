import type {
  PermissionKey,
} from '../types/auth';

export type HelpTopicGroup =
  | 'getting-started'
  | 'scheduling'
  | 'availability'
  | 'requests'
  | 'management'
  | 'system';

export interface HelpTopic {
  id: string;
  group: HelpTopicGroup;
  title: string;
  summary: string;
  route: string;
  routePrefixes: readonly string[];
  contextualQuery?: Readonly<
    Record<string, string>
  >;
  requiredAnyPermissions?: readonly PermissionKey[];
  requiredAllPermissions?: readonly PermissionKey[];
  steps: readonly string[];
  notes?: readonly string[];
  keywords?: readonly string[];
}
