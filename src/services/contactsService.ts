/**
 * קובץ: src/services/contactsService.ts
 * מטרה: טעינת ספר אנשי הקשר, היסטוריית השינויים ועדכון פרטי קשר באמצעות שירותי השרת.
 * מטרות עיקריות:
 * - קריאות RPC המופעלות בקובץ: get_contact_clients, get_contacts_directory, get_employee_contact_directory, import_contact_rows, create_contact_client, create_contact_record, update_contact_record_v2, update_employee_contact_phone, get_recent_contact_changes.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import { PerformanceDebugService } from './performanceDebugService';
import type { ContactChangeSummary, ContactImportResult, ContactImportRow, ContactRecord, EmployeeContact } from '../types/contacts';
/**
 * פעולה mapContact: מיפוי מפת התאמה / איש קשר.
 * @param r — הנתון r בהקשר הפעולה.
 * @returns ContactRecord — הפלט בהתאם לחתימה.
 */
const mapContact=(r:any):ContactRecord=>({id:r.id,clientId:r.client_id,clientName:r.client_name,branchName:r.branch_name,roleName:r.role_name,fullName:r.full_name,phone:r.phone,email:r.email,changeStatus:r.change_status,isActive:r.is_active,updatedAt:r.updated_at});
// contactsService — אנשי קשר / שירות.
export const contactsService={
 /**
  * פעולה אסינכרונית listClients: לקוחות.
  */
 async listClients(){return PerformanceDebugService.measureAsync('contacts.listClients',async()=>{const {data,error}=await supabase.rpc('get_contact_clients'); if(error) throw error; return (data??[]) as {id:string;name:string}[];});},
 /**
  * פעולה אסינכרונית listContacts: אנשי קשר.
  * @param clientId — לקוח / מזהה.
  */
 async listContacts(clientId?:string){return PerformanceDebugService.measureAsync('contacts.listContacts',async()=>{const {data,error}=await supabase.rpc('get_contacts_directory',{requested_client_id:clientId||null}); if(error) throw error; return (data??[]).map(mapContact);});},
 /**
  * פעולה אסינכרונית listEmployees: הנתון listEmployees בהקשר הפעולה.
  */
 async listEmployees(){return PerformanceDebugService.measureAsync('contacts.listEmployees',async()=>{const {data,error}=await supabase.rpc('get_employee_contact_directory'); if(error) throw error; return (data??[]).map((r:any):EmployeeContact=>({id:r.id,displayName:r.display_name,scheduleName:r.schedule_name,roleLabel:r.role_label,phone:r.phone}));});},
 /**
  * פעולה אסינכרונית importRows: ייבוא ייבוא / שורות.
  * הפעולה פונה ל־RPC: import_contact_rows.
  * @param clientName — לקוח / שם.
  * @param fileName — קובץ / שם.
  * @param rows — שורות.
  */
 async importRows(clientName:string,fileName:string,rows:ContactImportRow[]){const {data,error}=await supabase.rpc('import_contact_rows',{requested_client_name:clientName,requested_file_name:fileName,requested_rows:rows}); if(error) throw error; return data as ContactImportResult;},
 /**
  * פעולה אסינכרונית createClient: יצירת לקוח.
  * הפעולה פונה ל־RPC: create_contact_client.
  * @param name — שם.
  */
 async createClient(name:string){const {data,error}=await supabase.rpc('create_contact_client',{requested_name:name});if(error)throw error;return data as string;},
 /**
  * פעולה אסינכרונית createContact: יצירת איש קשר.
  * הפעולה פונה ל־RPC: create_contact_record.
  * @param input — קלט.
  */
 async createContact(input:{clientId:string;branchName:string|null;roleName:string;fullName:string;phone:string|null;email:string|null;needsReview:boolean}){const {data,error}=await supabase.rpc('create_contact_record',{requested_client_id:input.clientId,requested_branch_name:input.branchName,requested_role_name:input.roleName,requested_full_name:input.fullName,requested_phone:input.phone,requested_email:input.email,requested_needs_review:input.needsReview});if(error)throw error;return data as string;},
 /**
  * פעולה אסינכרונית updateContact: עדכון איש קשר.
  * הפעולה פונה ל־RPC: update_contact_record_v2.
  * @param input — קלט.
  */
 async updateContact(input:{id:string;clientId:string;branchName:string|null;roleName:string;fullName:string;phone:string|null;email:string|null;needsReview:boolean}){const {error}=await supabase.rpc('update_contact_record_v2',{requested_contact_id:input.id,requested_client_id:input.clientId,requested_branch_name:input.branchName,requested_role_name:input.roleName,requested_full_name:input.fullName,requested_phone:input.phone,requested_email:input.email,requested_needs_review:input.needsReview}); if(error) throw error;},
 /**
  * פעולה אסינכרונית updateEmployeePhone: עדכון מספר טלפון.
  * הפעולה פונה ל־RPC: update_employee_contact_phone.
  * @param userId — מזהה משתמש.
  * @param phone — מספר טלפון.
  */
 async updateEmployeePhone(userId:string,phone:string|null){const {error}=await supabase.rpc('update_employee_contact_phone',{requested_user_id:userId,requested_phone:phone});if(error)throw error;},
 /**
  * פעולה אסינכרונית recentChanges: הנתון recentChanges בהקשר הפעולה.
  * הפעולה פונה ל־RPC: get_recent_contact_changes.
  */
 async recentChanges(){const {data,error}=await supabase.rpc('get_recent_contact_changes'); if(error) throw error; return (data??[]).map((r:any):ContactChangeSummary=>({id:r.id,clientName:r.client_name,branchName:r.branch_name,roleName:r.role_name,fullName:r.full_name,changeType:r.change_type,createdAt:r.created_at}));}
};
