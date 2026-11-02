-- Read-only snapshot access and explicit, one-time approval for historical months.
create or replace function public.get_schedule_excel_export_month_snapshot(p_year integer, p_month integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_permissions up
    where up.user_id = auth.uid() and up.permission_key = 'schedule_export.manage'
  ) then raise exception 'Not authorized to view export mapping'; end if;
  return (select s.layout from public.schedule_excel_export_layout_monthly_snapshots s
          where s.year = p_year and s.month = p_month);
end $$;

create or replace function public.approve_schedule_excel_export_month_snapshot(
  p_year integer, p_month integer, p_layout jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_current date := date_trunc('month', now() at time zone 'Asia/Jerusalem')::date;
  v_month date;
  v_field text;
  v_id uuid;
  v_layout jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_permissions up
    where up.user_id = auth.uid() and up.permission_key = 'schedule_export.manage'
  ) then raise exception 'Not authorized to approve export mapping'; end if;
  if p_year not between 2020 and 2100 or p_month not between 1 and 12 then
    raise exception 'Invalid month'; end if;
  v_month := make_date(p_year, p_month, 1);
  if v_month >= v_current then raise exception 'Only historical months may be approved'; end if;
  if jsonb_typeof(p_layout) is distinct from 'object' or
     (select count(*) from jsonb_object_keys(p_layout)) <> 5 then
    raise exception 'Invalid mapping structure'; end if;
  foreach v_field in array array['morningRowJobTypeId','eveningRowJobTypeId',
    'nightRowJobTypeId','parallelMorningJobTypeId','dailyJobTypeId'] loop
    if not (p_layout ? v_field) or jsonb_typeof(p_layout -> v_field) not in ('null','string') then
      raise exception 'Invalid mapping field %', v_field; end if;
    if jsonb_typeof(p_layout -> v_field) = 'string' then
      begin v_id := (p_layout ->> v_field)::uuid;
      exception when invalid_text_representation then raise exception 'Invalid job type ID'; end;
      if not exists (select 1 from public.job_types where id = v_id) then
        raise exception 'Unknown job type in field %', v_field; end if;
    end if;
  end loop;
  -- Require at least one published/archived schedule for the selected month.
  if not exists (
    select 1 from public.dynamic_schedule_publications p
    where p.year = p_year and p.month = p_month and p.status in ('published','archived')
  ) then raise exception 'No published schedules for this month'; end if;
  insert into public.schedule_excel_export_layout_monthly_snapshots(year, month, layout)
  values(p_year, p_month, p_layout)
  on conflict (year, month) do nothing;
  select layout into v_layout from public.schedule_excel_export_layout_monthly_snapshots
  where year = p_year and month = p_month;
  if v_layout is distinct from p_layout then
    raise exception 'Historical mapping already approved with different values'; end if;
  return v_layout;
end $$;
revoke all on function public.get_schedule_excel_export_month_snapshot(integer,integer) from public, anon;
revoke all on function public.approve_schedule_excel_export_month_snapshot(integer,integer,jsonb) from public, anon;
grant execute on function public.get_schedule_excel_export_month_snapshot(integer,integer) to authenticated;
grant execute on function public.approve_schedule_excel_export_month_snapshot(integer,integer,jsonb) to authenticated;
