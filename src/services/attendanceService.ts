import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type { AttendanceRoleWorkspace, AttendanceStatisticsRow } from '../types/attendance';

const location = (): Promise<GeolocationPosition> => new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000,maximumAge:0}));
export const attendanceService = {
  async getMyWorkspace(): Promise<AttendanceRoleWorkspace[]> {
    return PerformanceDebugService.measureAsync('attendance.workspace',async()=>{const {data,error}=await supabase.rpc('get_my_attendance_workspace'); if(error) throw error; return ((data as {roles?:AttendanceRoleWorkspace[]})?.roles??[]);});
  },
  async clock(jobTypeId:string,action:'in'|'out',requireLocation=true): Promise<void> {
    return PerformanceDebugService.measureAsync(`attendance.clock.${action}`,async()=>{let lat:null|number=null,lng:null|number=null,accuracy:null|number=null; if(requireLocation){const p=await location();lat=p.coords.latitude;lng=p.coords.longitude;accuracy=p.coords.accuracy;} const {error}=await supabase.rpc('clock_my_attendance',{requested_job_type_id:jobTypeId,requested_action:action,requested_lat:lat,requested_lng:lng,requested_accuracy_m:accuracy}); if(error) throw error;});
  },
  async getStatistics(jobTypeId:string,years:number[],months:number[],userIds:string[]):Promise<AttendanceStatisticsRow[]> {
    const {data,error}=await supabase.rpc('get_dynamic_attendance_statistics',{requested_job_type_id:jobTypeId,requested_years:years.length?years:null,requested_months:months.length?months:null,requested_user_ids:userIds.length?userIds:null}); if(error) throw error; return ((data as {rows?:AttendanceStatisticsRow[]})?.rows??[]);
  },
  async updateSession(sessionId:string,clockInAt:string,clockOutAt:string|null,reason:string):Promise<void> {
    const {error}=await supabase.rpc('update_attendance_session_by_manager',{requested_session_id:sessionId,requested_clock_in_at:clockInAt,requested_clock_out_at:clockOutAt,requested_reason:reason||null}); if(error) throw error;
  },
};
