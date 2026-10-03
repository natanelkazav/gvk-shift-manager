export interface ActivityDefinition { key:string; label:string }
export interface ActivitySegment { id:string; activityKey:string; activityLabel:string; startedAt:string; endedAt:string|null }
export interface ActivityDay { id:string; status:'active'|'ended'|'needs_review'; workDate:string; startedAt:string; endedAt:string|null; segments:ActivitySegment[] }
export interface ActivityRoleContext { jobTypeId:string; jobTypeName:string; activities:ActivityDefinition[]; reminderEnabled:boolean; reminderTime:string; day:ActivityDay|null }
export interface ActivityWeekRow { userId:string; displayName:string; workDate:string; activityKey:string; activityLabel:string; hours:number; segmentId:string; startedAt:string; endedAt:string|null; status:string }
export interface ActivityWeek { weekStart:string; weekEnd:string; rows:ActivityWeekRow[] }
export interface ActivityRange { rangeStart:string; rangeEnd:string; rows:ActivityWeekRow[] }
export type StatisticsPeriodMode='day'|'week'|'month'|'year';
