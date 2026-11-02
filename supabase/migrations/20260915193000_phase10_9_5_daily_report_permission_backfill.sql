-- קובץ: supabase/migrations/20260915193000_phase10_9_5_daily_report_permission_backfill.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור דוחות פעילות יומיים.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_dynamic_job_type_active_features.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- Roles can have Daily Reports enabled before the new permission rows were saved
-- into job_type_permission_settings. Backfill only the Daily Reports feature.
-- הוספת רשומות ל־public.job_type_permission_settings בהתאם לקלט ולתנאים להלן.
insert into public.job_type_permission_settings
  (job_type_id, permission_key, audience, enabled, source, updated_at)
select
  jt.id,
  dm.permission_key,
  dm.audience,
  dm.default_enabled,
  'daily_reports_backfill',
  now()
from public.job_types jt
cross join public.dynamic_permission_manifest dm
where dm.feature_key='daily_reports'
  and jt.is_active=true
  and (
    coalesce((jt.scheduling_config#>>'{dailyReports,enabled}')::boolean,false)
    or exists (
      select 1 from public.job_type_capabilities c
      where c.job_type_id=jt.id and c.capability_key='daily_reports' and c.enabled=true
    )
  )
on conflict(job_type_id,permission_key,audience) do nothing;

-- Keep the active feature fully independent from scheduling strategy.
-- פונקציית מסד public.get_dynamic_job_type_active_features: שליפה או חישוב של סוג תפקיד.
create or replace function public.get_dynamic_job_type_active_features(requested_job_type_id uuid)
returns text[]
language plpgsql stable security definer set search_path=public
as $$
declare jt public.job_types%rowtype; features text[]:=array[]::text[]; change_mode text;
begin
 select * into jt from public.job_types where id=requested_job_type_id;
 -- הסתעפות לפי התנאי not found then return array[]::text[]; end if;.
 if not found then return array[]::text[]; end if;

 -- הסתעפות לפי התנאי jt.scheduling_strategy<>'none'.
 if jt.scheduling_strategy<>'none' then
   features:=array_append(features,'schedule');
   -- הסתעפות לפי התנאי coalesce((jt.availability_config->>'enabled')::boolean,false) then features:=array_append(features,'availability'); end .
   if coalesce((jt.availability_config->>'enabled')::boolean,false) then features:=array_append(features,'availability'); end if;
   change_mode:=coalesce(jt.scheduling_config->>'scheduleChangeMode','none');
   -- הסתעפות לפי התנאי change_mode='shift_exchange' then features:=array_append(features,'shift_exchange');.
   if change_mode='shift_exchange' then features:=array_append(features,'shift_exchange');
   elsif change_mode='self_edit' then features:=array_append(features,'self_edit'); end if;
   -- הסתעפות לפי התנאי jt.scheduling_strategy='monthly_rotation_constraints' then features:=array_append(features,'monthly_rotation'); end if;.
   if jt.scheduling_strategy='monthly_rotation_constraints' then features:=array_append(features,'monthly_rotation'); end if;
 end if;

 -- הסתעפות לפי התנאי coalesce((jt.statistics_config->>'enabled')::boolean,false) then features:=array_append(features,'statistics'); end if;.
 if coalesce((jt.statistics_config->>'enabled')::boolean,false) then features:=array_append(features,'statistics'); end if;
 -- הסתעפות לפי התנאי coalesce(jt.pay_model,'none')<>'none' then features:=array_append(features,'payroll'); end if;.
 if coalesce(jt.pay_model,'none')<>'none' then features:=array_append(features,'payroll'); end if;
 -- הסתעפות לפי התנאי exists(select 1 from public.job_type_capabilities c where c.job_type_id=jt.id and c.capability_key='daily_reports' and c.
 if exists(select 1 from public.job_type_capabilities c where c.job_type_id=jt.id and c.capability_key='daily_reports' and c.enabled=true)
    or coalesce((jt.scheduling_config#>>'{dailyReports,enabled}')::boolean,false)
 then features:=array_append(features,'daily_reports'); end if;

 return coalesce((select array_agg(distinct x order by x) from unnest(features) x),array[]::text[]);
end $$;

commit;
