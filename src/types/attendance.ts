export interface AttendanceRoleWorkspace {
  jobTypeId: string;
  jobTypeName: string;
  canClock: boolean;
  config: {
    enabled: boolean;
    requireLocation: boolean;
    workplaceName: string;
    latitude: number | null;
    longitude: number | null;
    radiusMeters: number;
    outsidePolicy: 'flag' | 'block';
    allowUnscheduled: boolean;
  };
  openSession: null | { id: string; clockInAt: string; clockInDistanceM: number | null; clockInWithinRadius: boolean | null };
  currentAssignment: null | { id: string; shiftDate: string; shiftName: string; startTime: string; endTime: string };
}
export interface AttendanceStatisticsRow {
  id:string; userId:string; displayName:string; scheduleName:string|null; workDate:string;
  clockInAt:string; clockInLat:number|null; clockInLng:number|null; clockInDistanceM:number|null; clockInWithinRadius:boolean|null;
  clockOutAt:string|null; clockOutLat:number|null; clockOutLng:number|null; clockOutDistanceM:number|null; clockOutWithinRadius:boolean|null;
  clockInEdited:boolean; clockOutEdited:boolean; missingExit:boolean; archived:boolean; canEdit:boolean;
  workedHours:number|null; hourlyRate:number|null; wage:number|null;
}
