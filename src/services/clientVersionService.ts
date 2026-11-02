/**
 * קובץ: src/services/clientVersionService.ts
 * מטרה: דיווח על גרסת הלקוח וטעינת תמונת מצב גרסאות למנהל.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ClientVersionStatus, ClientVersionUserRow, ClientVersionOverview, getClientId, isStandalonePwa, ClientVersionService.
 * - קריאות RPC המופעלות בקובץ: report_my_client_version, get_client_version_admin_overview.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import { APP_BUILD_ID, APP_VERSION } from '../config/appBuild';

// CLIENT_ID_STORAGE_KEY — לקוח / מזהה / מפתח.
const CLIENT_ID_STORAGE_KEY = 'gvk-client-installation-id';

/**
 * טיפוס ClientVersionStatus: לקוח / גרסה / סטטוס.
 */
export type ClientVersionStatus = 'current' | 'mixed' | 'outdated' | 'unknown';

/**
 * חוזה הנתונים ClientVersionUserRow: לקוח / גרסה / משתמש / שורה.
 */
export interface ClientVersionUserRow {
  // userId — מזהה משתמש.
  userId: string;
  // displayName — שם תצוגה.
  displayName: string;
  // email — כתובת דוא״ל.
  email: string;
  // isActive — האם הרשומה פעילה.
  isActive: boolean;
  lastLoginAt: string | null;
  // latestVersion — גרסה.
  latestVersion: string | null;
  // latestBuildId — מזהה.
  latestBuildId: string | null;
  latestSeenAt: string | null;
  // latestIsPwa — התקנה ועדכוני PWA.
  latestIsPwa: boolean | null;
  // deviceCount — כמות.
  deviceCount: number;
  // currentDeviceCount — כמות.
  currentDeviceCount: number;
  // outdatedDeviceCount — כמות.
  outdatedDeviceCount: number;
  // status — סטטוס.
  status: ClientVersionStatus;
  // jobTypes — סוגי תפקידים.
  jobTypes: Array<{ id: string; name: string }>;
}

/**
 * חוזה הנתונים ClientVersionOverview: לקוח / גרסה.
 */
export interface ClientVersionOverview {
  // currentVersion — גרסה.
  currentVersion: string;
  // currentBuildId — מזהה.
  currentBuildId: string;
  // users — משתמשים.
  users: ClientVersionUserRow[];
  // summary — סיכום.
  summary: {
    // total — סך הכול.
    total: number;
    current: number;
    mixed: number;
    outdated: number;
    unknown: number;
  };
}

/**
 * פעולה getClientId: שליפה או חישוב של לקוח / מזהה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getClientId(): string {
  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY)?.trim();
  if (existing) return existing;

  const generated = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
  return generated;
}

/**
 * פעולה isStandalonePwa: בדיקת תנאי עבור התקנה ועדכוני PWA.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isStandalonePwa(): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

/**
 * איגוד פעולות לקוח / גרסה / שירות במחלקה ClientVersionService.
 */
class ClientVersionService {
  /**
   * פעולה אסינכרונית reportCurrentClient: דוח / לקוח.
   * הפעולה פונה ל־RPC: report_my_client_version.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async reportCurrentClient(): Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { error } = await supabase.rpc('report_my_client_version', {
      requested_client_id: getClientId(),
      requested_app_version: APP_VERSION,
      requested_build_id: APP_BUILD_ID,
      requested_is_pwa: isStandalonePwa(),
      requested_platform: navigator.platform || null,
      requested_user_agent: navigator.userAgent || null,
    });

    if (error) throw error;
  }

  /**
   * פעולה אסינכרונית getAdminOverview: שליפה או חישוב של הנתון getAdminOverview בהקשר הפעולה.
   * הפעולה פונה ל־RPC: get_client_version_admin_overview.
   * @returns Promise<ClientVersionOverview> — הפלט בהתאם לחתימה.
   */
  async getAdminOverview(): Promise<ClientVersionOverview> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('get_client_version_admin_overview', {
      requested_current_version: APP_VERSION,
      requested_current_build_id: APP_BUILD_ID,
    });

    if (error) throw error;

    const raw = (data ?? {}) as Record<string, unknown>;
    // rawUsers — משתמשים.
    const rawUsers = Array.isArray(raw.users) ? raw.users : [];
    // users — משתמשים.
    const users = rawUsers.map((entry) => {
      // row — שורה.
      const row = entry as Record<string, unknown>;
      // jobTypes — סוגי תפקידים.
      const jobTypes = Array.isArray(row.jobTypes)
        ? row.jobTypes.map((jobType) => {
            // item — פריט.
            const item = jobType as Record<string, unknown>;
            return { id: String(item.id ?? ''), name: String(item.name ?? '') };
          }).filter((item) => item.id && item.name)
        : [];
      return {
        userId: String(row.userId ?? ''),
        displayName: String(row.displayName ?? ''),
        email: String(row.email ?? ''),
        isActive: row.isActive === true,
        lastLoginAt: typeof row.lastLoginAt === 'string' ? row.lastLoginAt : null,
        latestVersion: typeof row.latestVersion === 'string' ? row.latestVersion : null,
        latestBuildId: typeof row.latestBuildId === 'string' ? row.latestBuildId : null,
        latestSeenAt: typeof row.latestSeenAt === 'string' ? row.latestSeenAt : null,
        latestIsPwa: typeof row.latestIsPwa === 'boolean' ? row.latestIsPwa : null,
        deviceCount: Number(row.deviceCount ?? 0),
        currentDeviceCount: Number(row.currentDeviceCount ?? 0),
        outdatedDeviceCount: Number(row.outdatedDeviceCount ?? 0),
        status: (['current', 'mixed', 'outdated', 'unknown'].includes(String(row.status))
          ? String(row.status)
          : 'unknown') as ClientVersionStatus,
        jobTypes,
      } satisfies ClientVersionUserRow;
    });

    // summaryRaw — סיכום.
    const summaryRaw = (raw.summary ?? {}) as Record<string, unknown>;
    return {
      currentVersion: String(raw.currentVersion ?? APP_VERSION),
      currentBuildId: String(raw.currentBuildId ?? APP_BUILD_ID),
      users,
      summary: {
        total: Number(summaryRaw.total ?? users.length),
        current: Number(summaryRaw.current ?? 0),
        mixed: Number(summaryRaw.mixed ?? 0),
        outdated: Number(summaryRaw.outdated ?? 0),
        unknown: Number(summaryRaw.unknown ?? 0),
      },
    };
  }
}

// clientVersionService — לקוח / גרסה / שירות.
export const clientVersionService = new ClientVersionService();
