/**
 * קובץ: src/help/helpTypes.ts
 * מטרה: מימוש עזרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: HelpTopicGroup, HelpTopic.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import type {
  PermissionKey,
} from '../types/auth';

/**
 * טיפוס HelpTopicGroup: עזרה / קבוצה.
 */
export type HelpTopicGroup =
  | 'getting-started'
  | 'scheduling'
  | 'availability'
  | 'requests'
  | 'management'
  | 'system';

/**
 * חוזה הנתונים HelpTopic: עזרה.
 */
export interface HelpTopic {
  // id — מזהה.
  id: string;
  // group — קבוצה.
  group: HelpTopicGroup;
  // title — כותרת.
  title: string;
  // summary — סיכום.
  summary: string;
  route: string;
  routePrefixes: readonly string[];
  contextualQuery?: Readonly<
    Record<string, string>
  >;
  // requiredAnyPermissions — הרשאות (אופציונלי).
  requiredAnyPermissions?: readonly PermissionKey[];
  // requiredAllPermissions — הרשאות (אופציונלי).
  requiredAllPermissions?: readonly PermissionKey[];
  steps: readonly string[];
  // notes — הערות (אופציונלי).
  notes?: readonly string[];
  keywords?: readonly string[];
}
