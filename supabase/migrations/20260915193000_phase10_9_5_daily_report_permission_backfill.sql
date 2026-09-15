begin;

-- Roles can have Daily Reports enabled before the new permission rows were saved
-- into job_type_permission_settings. Backfill only the Daily Reports feature.
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
create or replace function public.get_dynamic_job_type_active_features(requested_job_type_id uuid)
returns text[]
language plpgsql stable security definer set search_path=public
as $$
declare jt public.job_types%rowtype; features text[]:=array[]::text[]; change_mode text;
begin
 select * into jt from public.job_types where id=requested_job_type_id;
 if not found then return array[]::text[]; end if;

 if jt.scheduling_strategy<>'none' then
   features:=array_append(features,'schedule');
   if coalesce((jt.availability_config->>'enabled')::boolean,false) then features:=array_append(features,'availability'); end if;
   change_mode:=coalesce(jt.scheduling_config->>'scheduleChangeMode','none');
   if change_mode='shift_exchange' then features:=array_append(features,'shift_exchange');
   elsif change_mode='self_edit' then features:=array_append(features,'self_edit'); end if;
   if jt.scheduling_strategy='monthly_rotation_constraints' then features:=array_append(features,'monthly_rotation'); end if;
 end if;

 if coalesce((jt.statistics_config->>'enabled')::boolean,false) then features:=array_append(features,'statistics'); end if;
 if coalesce(jt.pay_model,'none')<>'none' then features:=array_append(features,'payroll'); end if;
 if exists(select 1 from public.job_type_capabilities c where c.job_type_id=jt.id and c.capability_key='daily_reports' and c.enabled=true)
    or coalesce((jt.scheduling_config#>>'{dailyReports,enabled}')::boolean,false)
 then features:=array_append(features,'daily_reports'); end if;

 return coalesce((select array_agg(distinct x order by x) from unnest(features) x),array[]::text[]);
end $$;

commit;
