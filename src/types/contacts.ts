export type ContactChangeStatus = 'current' | 'new' | 'updated' | 'needs_review';
export interface ContactRecord { id:string; clientId:string; clientName:string; branchName:string|null; roleName:string; fullName:string; phone:string|null; email:string|null; changeStatus:ContactChangeStatus; isActive:boolean; updatedAt:string; }
export interface EmployeeContact { id:string; displayName:string; scheduleName:string|null; roleLabel:string; phone:string|null; }
export interface ContactImportRow { branchName:string|null; roleName:string; fullName:string; phone:string|null; email:string|null; sourceRow:number; needsReview:boolean; }
export interface ContactImportResult { imported:number; added:number; updated:number; unchanged:number; needsReview:number; affectedBranches:string[]; }
export interface ContactChangeSummary { id:string; clientName:string; branchName:string|null; roleName:string; fullName:string; changeType:string; createdAt:string; }
