import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type {
  DashboardWidgetPreference,
  DashboardWidgetSettings,
  ManagerDashboardStaffingWidget,
} from '../types/dashboardWidgets';

export const dashboardWidgetService = {
  async canConfigure(): Promise<boolean> {
    const { data, error } = await supabase.rpc('can_configure_manager_dashboard');
    if (error) return false;
    return Boolean(data);
  },

  async getSettings(): Promise<DashboardWidgetSettings> {
    return PerformanceDebugService.measureAsync('dashboard.phase10.11.widget-settings', async () => {
      const { data, error } = await supabase.rpc('get_my_dashboard_widget_settings');
      if (error) throw new Error(error.message || 'לא ניתן לטעון את הגדרות לוח הבקרה.');
      const value = (data ?? {}) as Partial<DashboardWidgetSettings>;
      return {
        canConfigure: Boolean(value.canConfigure),
        jobTypes: Array.isArray(value.jobTypes) ? value.jobTypes : [],
        widgets: Array.isArray(value.widgets) ? value.widgets : [],
      };
    });
  },

  async saveSettings(widgets: DashboardWidgetPreference[]): Promise<DashboardWidgetSettings> {
    const payload = widgets.map((widget) => ({
      widgetType: 'staffing',
      timeScope: widget.timeScope,
      jobTypeId: widget.jobTypeId,
    }));
    const { data, error } = await supabase.rpc('save_my_dashboard_widget_settings', {
      requested_widgets: payload,
    });
    if (error) throw new Error(error.message || 'לא ניתן לשמור את הגדרות לוח הבקרה.');
    return data as DashboardWidgetSettings;
  },

  async getDashboardWidgets(): Promise<ManagerDashboardStaffingWidget[]> {
    return PerformanceDebugService.measureAsync('dashboard.phase10.11.manager-widgets', async () => {
      const { data, error } = await supabase.rpc('get_my_manager_dashboard_widgets');
      if (error) throw new Error(error.message || 'לא ניתן לטעון את כרטיסי לוח הבקרה.');
      return Array.isArray(data) ? data as ManagerDashboardStaffingWidget[] : [];
    });
  },
};
