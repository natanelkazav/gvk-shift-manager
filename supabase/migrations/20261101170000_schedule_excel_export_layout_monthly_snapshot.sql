-- Immutable monthly mapping snapshots for the archive. Does not alter live layout.
create table if not exists public.schedule_excel_export_layout_monthly_snapshots (
  year integer not null check (year between 2020 and 2100),
  month integer not null check (month between 1 and 12),
  layout jsonb not null,
  captured_at timestamptz not null default now(),
  primary key (year, month)
);
alter table public.schedule_excel_export_layout_monthly_snapshots enable row level security;
revoke all on public.schedule_excel_export_layout_monthly_snapshots from anon, authenticated;

-- Called by a trusted server process using the service-role key only.
-- The ON CONFLICT DO NOTHING policy deliberately prevents historical drift.
create or replace function public.capture_schedule_excel_export_layout_snapshot(
  p_year integer, p_month integer
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_layout jsonb;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only the archive service can capture monthly layout';
  end if;
  if p_year not between 2020 and 2100 or p_month not between 1 and 12 then
    raise exception 'Invalid archive month';
  end if;
  select layout into v_layout from public.schedule_excel_export_layout where id = 1;
  if v_layout is null then
    raise exception 'No central Excel export layout has been saved';
  end if;
  insert into public.schedule_excel_export_layout_monthly_snapshots(year, month, layout)
  values (p_year, p_month, v_layout)
  on conflict (year, month) do nothing;
  select layout into v_layout from public.schedule_excel_export_layout_monthly_snapshots
  where year = p_year and month = p_month;
  return v_layout;
end $$;
revoke all on function public.capture_schedule_excel_export_layout_snapshot(integer, integer) from public, anon, authenticated;
grant execute on function public.capture_schedule_excel_export_layout_snapshot(integer, integer) to service_role;
