import ExcelJS from 'npm:exceljs@4.4.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { renderScheduleWorkbook } from '../../../src/services/scheduleWorkbookRenderer.ts';
import type { ScheduleExcelLayout } from '../../../src/types/scheduleFileLayout.ts';
import type { DynamicScheduleCalendarWorkspace } from '../../../src/types/dynamicShiftsWorkspace.ts';
import { templateBase64 } from './templateBase64.ts';

const mappingFields = ['morningRowJobTypeId','eveningRowJobTypeId','nightRowJobTypeId','parallelMorningJobTypeId','dailyJobTypeId'] as const;
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: {'content-type':'application/json; charset=utf-8', 'cache-control':'no-store'} });
function requireEnv(key: string): string {
  const value = Deno.env.get(key)?.trim();
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
}
function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function validateLayout(value: unknown): ScheduleExcelLayout {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('No approved monthly export mapping');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).length !== mappingFields.length || mappingFields.some(k => !(k in data) || (data[k] !== null && typeof data[k] !== 'string'))) {
    throw new Error('Invalid approved monthly mapping');
  }
  if (!data.eveningRowJobTypeId || !data.nightRowJobTypeId || !data.dailyJobTypeId) throw new Error('Incomplete monthly mapping');
  return data as unknown as ScheduleExcelLayout;
}

Deno.serve(async request => {
  if (request.method !== 'POST') return reply({error:'Method not allowed'},405);
  try {
    const secret = requireEnv('MONTHLY_ARCHIVE_CRON_SECRET');
    if (request.headers.get('x-cron-secret') !== secret) return reply({error:'Unauthorized'},401);
    const body = await request.json().catch(() => ({}));
    const year = body.year, month = body.month;
    if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) return reply({error:'Invalid year/month'},400);
    const client = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {auth:{persistSession:false,autoRefreshToken:false}});
    const {data:snapshot,error:snapshotError} = await client.from('schedule_excel_export_layout_monthly_snapshots').select('layout').eq('year',year).eq('month',month).maybeSingle();
    if (snapshotError) throw snapshotError;
    // Fail closed: never silently use current mapping for an old month.
    const layout = validateLayout(snapshot?.layout);
    const ids = [...new Set(mappingFields.map(key => layout[key]).filter((id): id is string => Boolean(id)))];
    const {data:publications,error:pubError} = await client.from('dynamic_schedule_publications').select('job_type_id,status').eq('year',year).eq('month',month).in('job_type_id',ids).in('status',['published','archived']);
    if (pubError) throw pubError;
    for (const id of ids) {
      const matches = (publications ?? []).filter(p => p.job_type_id === id);
      if (matches.length !== 1) throw new Error(`Expected exactly one published schedule for mapped job type ${id}; found ${matches.length}`);
    }
    const {data:workspace,error:workspaceError} = await client.rpc('get_dynamic_schedule_export_workspace', {requested_year:year,requested_month:month,requested_job_type_ids:ids});
    if (workspaceError) throw workspaceError;
    if (!workspace || !Array.isArray(workspace.slots)) throw new Error('Export workspace unavailable');
    const typedWorkspace = workspace as DynamicScheduleCalendarWorkspace;
    // Calendar holiday names may be provided by the workspace itself, but this preview
    // deliberately does not invent external holiday data. The reviewer must compare H cells.
    const workbook = new ExcelJS.Workbook();
    const bytes = decodeBase64(templateBase64);
    await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
    const counts = renderScheduleWorkbook(workbook, typedWorkspace, [], year, month, layout);
    const selectedSlots = typedWorkspace.slots.filter(s => ids.includes(s.jobTypeId));
    const sourceAssignments = selectedSlots.reduce((sum,s) => sum + s.assignments.length,0);
    const exportedAssignments = counts.primaryAssignments + counts.parallelAssignments + counts.dailyAssignments;
    if (exportedAssignments !== sourceAssignments) throw new Error(`Assignment count mismatch: source=${sourceAssignments} rendered=${exportedAssignments}`);
    const output = await workbook.xlsx.writeBuffer();
    const outputBytes = new Uint8Array(output);
    const digest = await crypto.subtle.digest('SHA-256',outputBytes);
    const sha256 = Array.from(new Uint8Array(digest), b=>b.toString(16).padStart(2,'0')).join('');
    // No mail, no archive updates, no writes. Return an artifact for local review.
    const b64 = btoa(Array.from(outputBytes, b=>String.fromCharCode(b)).join(''));
    return reply({dryRun:true,year,month,sourceAssignments,exportedAssignments,counts,sha256,fileName:`schedule-preview-${year}-${String(month).padStart(2,'0')}.xlsx`,fileBase64:b64,warning:'Holiday notes must be compared to manual export before production integration'});
  } catch (error) {
    console.error('Monthly archive preview failed',error);
    return reply({error: error instanceof Error ? error.message : 'Preview failed'},500);
  }
});
