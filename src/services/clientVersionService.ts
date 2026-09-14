import { supabase } from '../lib/supabase';
import { APP_BUILD_ID, APP_VERSION } from '../config/appBuild';

const CLIENT_ID_STORAGE_KEY = 'gvk-client-installation-id';

export type ClientVersionStatus = 'current' | 'mixed' | 'outdated' | 'unknown';

export interface ClientVersionUserRow {
  userId: string;
  displayName: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  latestVersion: string | null;
  latestBuildId: string | null;
  latestSeenAt: string | null;
  latestIsPwa: boolean | null;
  deviceCount: number;
  currentDeviceCount: number;
  outdatedDeviceCount: number;
  status: ClientVersionStatus;
  jobTypes: Array<{ id: string; name: string }>;
}

export interface ClientVersionOverview {
  currentVersion: string;
  currentBuildId: string;
  users: ClientVersionUserRow[];
  summary: {
    total: number;
    current: number;
    mixed: number;
    outdated: number;
    unknown: number;
  };
}

function getClientId(): string {
  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY)?.trim();
  if (existing) return existing;

  const generated = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
  return generated;
}

function isStandalonePwa(): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

class ClientVersionService {
  async reportCurrentClient(): Promise<void> {
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

  async getAdminOverview(): Promise<ClientVersionOverview> {
    const { data, error } = await supabase.rpc('get_client_version_admin_overview', {
      requested_current_version: APP_VERSION,
      requested_current_build_id: APP_BUILD_ID,
    });

    if (error) throw error;

    const raw = (data ?? {}) as Record<string, unknown>;
    const rawUsers = Array.isArray(raw.users) ? raw.users : [];
    const users = rawUsers.map((entry) => {
      const row = entry as Record<string, unknown>;
      const jobTypes = Array.isArray(row.jobTypes)
        ? row.jobTypes.map((jobType) => {
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

export const clientVersionService = new ClientVersionService();
