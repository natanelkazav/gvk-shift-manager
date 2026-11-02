/**
 * קובץ: src/services/attendanceService.ts
 * מטרה: דיווח כניסה ויציאה, שליפת נוכחות ועיבוד נתוני המיקום ותוצאות השרת.
 * מטרות עיקריות:
 * - קריאות RPC המופעלות בקובץ: get_my_attendance_workspace, clock_my_attendance, get_dynamic_attendance_statistics, update_attendance_session_by_manager.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type { AttendanceRoleWorkspace, AttendanceStatisticsRow } from '../types/attendance';

/**
 * פעולה location: הנתון location בהקשר הפעולה.
 * @returns Promise<GeolocationPosition> — הפלט בהתאם לחתימה.
 */
const location = (): Promise<GeolocationPosition> => new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
// attendanceService — נוכחות / שירות.
export const attendanceService = {
  /**
   * פעולה אסינכרונית getMyWorkspace: שליפה או חישוב של הנתון getMyWorkspace בהקשר הפעולה.
   * @returns Promise<AttendanceRoleWorkspace[]> — הפלט בהתאם לחתימה.
   */
  async getMyWorkspace(): Promise<AttendanceRoleWorkspace[]> {
    return PerformanceDebugService.measureAsync('attendance.workspace',async()=>{const {data,error}=await supabase.rpc('get_my_attendance_workspace'); if(error) throw error; return ((data as {roles?:AttendanceRoleWorkspace[]})?.roles??[]);});
  },
  /**
   * פעולה אסינכרונית clock: הנתון clock בהקשר הפעולה.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param action — הנתון action בהקשר הפעולה.
   * @param requireLocation — הנתון requireLocation בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async clock(jobTypeId:string,action:'in'|'out',requireLocation=true): Promise<void> {
    return PerformanceDebugService.measureAsync(`attendance.clock.${action}`,async()=>{let lat:null|number=null,lng:null|number=null,accuracy:null|number=null; if(requireLocation){const p=await location();lat=p.coords.latitude;lng=p.coords.longitude;accuracy=p.coords.accuracy;} const {error}=await supabase.rpc('clock_my_attendance',{requested_job_type_id:jobTypeId,requested_action:action,requested_lat:lat,requested_lng:lng,requested_accuracy_m:accuracy}); if(error) throw error;});
  },
  /**
   * פעולה אסינכרונית getStatistics: שליפה או חישוב של סטטיסטיקה.
   * הפעולה פונה ל־RPC: get_dynamic_attendance_statistics.
   * @param jobTypeId — מזהה סוג התפקיד.
   * @param years — שנים.
   * @param months — חודשים.
   * @param userIds — מזהה משתמש.
   * @returns Promise<AttendanceStatisticsRow[]> — הפלט בהתאם לחתימה.
   */
  async getStatistics(jobTypeId:string,years:number[],months:number[],userIds:string[]):Promise<AttendanceStatisticsRow[]> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {data,error}=await supabase.rpc('get_dynamic_attendance_statistics',{requested_job_type_id:jobTypeId,requested_years:years.length?years:null,requested_months:months.length?months:null,requested_user_ids:userIds.length?userIds:null}); if(error) throw error; return ((data as {rows?:AttendanceStatisticsRow[]})?.rows??[]);
  },
  /**
   * פעולה אסינכרונית updateSession: עדכון סשן.
   * הפעולה פונה ל־RPC: update_attendance_session_by_manager.
   * @param sessionId — סשן / מזהה.
   * @param clockInAt — הנתון clockInAt בהקשר הפעולה.
   * @param clockOutAt — הנתון clockOutAt בהקשר הפעולה.
   * @param reason — הנתון reason בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  async updateSession(sessionId:string,clockInAt:string,clockOutAt:string|null,reason:string):Promise<void> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {error}=await supabase.rpc('update_attendance_session_by_manager',{requested_session_id:sessionId,requested_clock_in_at:clockInAt,requested_clock_out_at:clockOutAt,requested_reason:reason||null}); if(error) throw error;
  },
};
