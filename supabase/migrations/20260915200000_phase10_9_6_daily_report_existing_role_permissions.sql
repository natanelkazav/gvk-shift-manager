begin;

-- Existing roles created during the 10.9 rollout can already have Daily Reports
-- enabled while role_builder stored the new permission rows as disabled.
-- A Daily Reports role without submit permission cannot render its employee card.
-- Repair only roles where the feature itself is explicitly enabled.
with enabled_daily_roles as (
  select jt.id, jt.scheduling_config
  from public.job_types jt
  where jt.is_active=true
    and jt.legacy_role is null
    and (
      coalesce((jt.scheduling_config#>>'{dailyReports,enabled}')::boolean,false)
      or exists (
        select 1 from public.job_type_capabilities c
        where c.job_type_id=jt.id
          and c.capability_key='daily_reports'
          and c.enabled=true
      )
    )
)
insert into public.job_type_permission_settings
  (job_type_id,permission_key,audience,enabled,source,updated_at)
select r.id, dm.permission_key, dm.audience,
  case
    when dm.permission_key='daily_reports.submit' then true
    when dm.permission_key='daily_reports.add_subject'
      then coalesce((r.scheduling_config#>>'{dailyReports,allowAddSubjects}')::boolean,true)
    when dm.permission_key='daily_reports.add_customer'
      then coalesce((r.scheduling_config#>>'{dailyReports,allowAddCustomers}')::boolean,true)
    when dm.permission_key='daily_reports.upload_attachment'
      then coalesce((r.scheduling_config#>>'{dailyReports,allowAttachments}')::boolean,true)
    when dm.permission_key in (
      'daily_reports.view_received',
      'daily_reports.manage_subjects',
      'daily_reports.manage_customers',
      'daily_reports.view_attachment'
    ) then true
    else dm.default_enabled
  end,
  'daily_reports_rollout_repair',
  now()
from enabled_daily_roles r
join public.dynamic_permission_manifest dm on dm.feature_key='daily_reports'
on conflict(job_type_id,permission_key,audience) do update
set enabled=excluded.enabled,
    source=case
      when public.job_type_permission_settings.source in ('role_builder','manifest','daily_reports_backfill')
        then 'daily_reports_rollout_repair'
      else public.job_type_permission_settings.source
    end,
    updated_at=case
      when public.job_type_permission_settings.source in ('role_builder','manifest','daily_reports_backfill')
        then now()
      else public.job_type_permission_settings.updated_at
    end
where public.job_type_permission_settings.source in ('role_builder','manifest','daily_reports_backfill');

commit;
