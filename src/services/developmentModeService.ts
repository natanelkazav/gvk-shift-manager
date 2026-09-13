import { supabase } from '../lib/supabase';

export interface DevelopmentModeState {
  enabled: boolean;
  expiresAt: string | null;
  enabledAt: string | null;
}

interface DevelopmentModeRow {
  enabled: boolean;
  expires_at: string | null;
  enabled_at: string | null;
}

function mapState(row: DevelopmentModeRow | null): DevelopmentModeState {
  return {
    enabled: Boolean(row?.enabled),
    expiresAt: row?.expires_at ?? null,
    enabledAt: row?.enabled_at ?? null,
  };
}

export const developmentModeService = {
  async getState(): Promise<DevelopmentModeState> {
    const { data, error } = await supabase.rpc('get_my_development_mode');
    if (error) throw error;
    return mapState((data as DevelopmentModeRow[] | null)?.[0] ?? null);
  },

  async setState(enabled: boolean, durationMinutes: number | null): Promise<DevelopmentModeState> {
    const { data, error } = await supabase.rpc('set_my_development_mode', {
      requested_enabled: enabled,
      requested_duration_minutes: durationMinutes,
    });
    if (error) throw error;
    return mapState((data as DevelopmentModeRow[] | null)?.[0] ?? null);
  },
};
