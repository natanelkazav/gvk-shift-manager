/**
 * קובץ: src/services/dashboardWidgetService.ts
 * מטרה: טעינה ושמירה של תצורת הווידג׳טים בלוח הבקרה.
 * מטרות עיקריות:
 * - קריאות RPC המופעלות בקובץ: can_configure_manager_dashboard, get_my_dashboard_widget_settings, save_my_dashboard_widget_settings, get_my_manager_dashboard_widgets.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type {
  DashboardWidgetPreference,
  DashboardWidgetSettings,
  ManagerDashboardStaffingWidget,
} from '../types/dashboardWidgets';

// dashboardWidgetService — לוח בקרה / שירות.
export const dashboardWidgetService = {
  /**
   * פעולה אסינכרונית canConfigure: בדיקת אפשרות פעולה עבור הנתון canConfigure בהקשר הפעולה.
   * הפעולה פונה ל־RPC: can_configure_manager_dashboard.
   * @returns Promise<boolean> — הפלט בהתאם לחתימה.
   */
  async canConfigure(): Promise<boolean> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('can_configure_manager_dashboard');
    if (error) return false;
    return Boolean(data);
  },

  /**
   * פעולה אסינכרונית getSettings: שליפה או חישוב של הגדרות.
   * @returns Promise<DashboardWidgetSettings> — הפלט בהתאם לחתימה.
   */
  async getSettings(): Promise<DashboardWidgetSettings> {
    return PerformanceDebugService.measureAsync('dashboard.phase10.11.widget-settings', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_my_dashboard_widget_settings');
      if (error) throw new Error(error.message || 'לא ניתן לטעון את הגדרות לוח הבקרה.');
      // value — ערך.
      const value = (data ?? {}) as Partial<DashboardWidgetSettings>;
      return {
        canConfigure: Boolean(value.canConfigure),
        jobTypes: Array.isArray(value.jobTypes) ? value.jobTypes : [],
        widgets: Array.isArray(value.widgets) ? value.widgets : [],
      };
    });
  },

  /**
   * פעולה אסינכרונית saveSettings: שמירת הגדרות.
   * הפעולה פונה ל־RPC: save_my_dashboard_widget_settings.
   * @param widgets — הנתון widgets בהקשר הפעולה.
   * @returns Promise<DashboardWidgetSettings> — הפלט בהתאם לחתימה.
   */
  async saveSettings(widgets: DashboardWidgetPreference[]): Promise<DashboardWidgetSettings> {
    const payload = widgets.map((widget) => ({
      widgetType: 'staffing',
      timeScope: widget.timeScope,
      jobTypeId: widget.jobTypeId,
    }));
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const { data, error } = await supabase.rpc('save_my_dashboard_widget_settings', {
      requested_widgets: payload,
    });
    if (error) throw new Error(error.message || 'לא ניתן לשמור את הגדרות לוח הבקרה.');
    return data as DashboardWidgetSettings;
  },

  /**
   * פעולה אסינכרונית getDashboardWidgets: שליפה או חישוב של לוח בקרה.
   * @returns Promise<ManagerDashboardStaffingWidget[]> — הפלט בהתאם לחתימה.
   */
  async getDashboardWidgets(): Promise<ManagerDashboardStaffingWidget[]> {
    return PerformanceDebugService.measureAsync('dashboard.phase10.11.manager-widgets', async () => {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { data, error } = await supabase.rpc('get_my_manager_dashboard_widgets');
      if (error) throw new Error(error.message || 'לא ניתן לטעון את כרטיסי לוח הבקרה.');
      return Array.isArray(data) ? data as ManagerDashboardStaffingWidget[] : [];
    });
  },
};
