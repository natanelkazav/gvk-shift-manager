begin;

-- Attendance permissions were added to the manifest after the original
-- permission-settings backfill had already run. Existing Job Types therefore
-- can have attendance enabled while having no inherited attendance.clock row,
-- which makes the employee clock card disappear from the dashboard.
do $$
declare
  r record;
begin
  for r in
    select jt.id
    from public.job_types jt
    where jt.is_active = true
      and coalesce((jt.scheduling_config #>> '{attendance,enabled}')::boolean, false) = true
  loop
    perform public.sync_dynamic_job_type_permission_settings(r.id);
  end loop;
end $$;

commit;
