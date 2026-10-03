import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type { ActivityRange,ActivityRoleContext,ActivityWeek } from '../types/activityTracking';
export const activityTrackingService={
 canViewOwnStatistics:()=>PerformanceDebugService.measureAsync('activityTracking.canViewOwnStatistics',async()=>{const{data,error}=await supabase.rpc('can_view_own_activity_statistics');if(error)throw error;return data===true;}),
 getMyContext:()=>PerformanceDebugService.measureAsync('activityTracking.getMyContext',async()=>{const{data,error}=await supabase.rpc('get_my_activity_tracking_context');if(error)throw error;return(data??[]) as ActivityRoleContext[];}),
 switchActivity:(jobTypeId:string,activityKey:string)=>PerformanceDebugService.measureAsync('activityTracking.switch',async()=>{const{data,error}=await supabase.rpc('switch_my_activity',{requested_job_type_id:jobTypeId,requested_activity_key:activityKey});if(error)throw error;return data;}),
 pauseActivity:(jobTypeId:string)=>PerformanceDebugService.measureAsync('activityTracking.pause',async()=>{const{data,error}=await supabase.rpc('pause_my_activity',{requested_job_type_id:jobTypeId});if(error)throw error;return data;}),
 endDay:(jobTypeId:string)=>PerformanceDebugService.measureAsync('activityTracking.endDay',async()=>{const{data,error}=await supabase.rpc('end_my_activity_day',{requested_job_type_id:jobTypeId});if(error)throw error;return data;}),
 getWeek:(jobTypeId:string,weekStart?:string)=>PerformanceDebugService.measureAsync('activityTracking.getWeek',async()=>{const{data,error}=await supabase.rpc('get_activity_tracking_week',{requested_job_type_id:jobTypeId,requested_week_start:weekStart??null});if(error)throw error;return data as ActivityWeek;}),
 getRange:(jobTypeId:string,start:string,end:string)=>PerformanceDebugService.measureAsync('activityTracking.getRange',async()=>{const{data,error}=await supabase.rpc('get_activity_tracking_range',{requested_job_type_id:jobTypeId,requested_start:start,requested_end:end});if(error)throw error;return data as ActivityRange;}),
 getPeriods:(jobTypeId:string)=>PerformanceDebugService.measureAsync('activityTracking.getPeriods',async()=>{const{data,error}=await supabase.rpc('get_activity_tracking_periods',{requested_job_type_id:jobTypeId});if(error)throw error;return (data??[]) as Array<{year:number;month:number}>;}),
 updateSegment:async(id:string,key:string,start:string,end:string,reason:string)=>{const{error}=await supabase.rpc('update_activity_tracking_segment',{requested_segment_id:id,requested_activity_key:key,requested_started_at:start,requested_ended_at:end,requested_reason:reason});if(error)throw error;}
};
