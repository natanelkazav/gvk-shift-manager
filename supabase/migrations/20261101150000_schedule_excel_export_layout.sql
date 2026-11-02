-- Central export mapping, shared across users. No changes to published schedules.
create table if not exists public.schedule_excel_export_layout (
  id integer primary key default 1 check (id = 1),
  layout jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.schedule_excel_export_layout enable row level security;
revoke all on public.schedule_excel_export_layout from anon, authenticated;

create or replace function public.get_schedule_excel_export_layout()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_permissions up
    where up.user_id = auth.uid() and up.permission_key = 'schedule_export.manage'
  ) then raise exception 'Not authorized to view export mapping'; end if;
  return (select layout from public.schedule_excel_export_layout where id = 1);
end $$;

create or replace function public.save_schedule_excel_export_layout(p_layout jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  field text;
  role_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.user_permissions up
    where up.user_id = auth.uid() and up.permission_key = 'schedule_export.manage'
  ) then raise exception 'Not authorized to change export mapping'; end if;
  if jsonb_typeof(p_layout) is distinct from 'object' then
    raise exception 'Export mapping must be an object';
  end if;
  if (select count(*) from jsonb_object_keys(p_layout)) <> 5 then
    raise exception 'Export mapping must contain exactly five fields';
  end if;
  foreach field in array array['morningRowJobTypeId','eveningRowJobTypeId','nightRowJobTypeId','parallelMorningJobTypeId','dailyJobTypeId'] loop
    if not (p_layout ? field) or jsonb_typeof(p_layout -> field) not in ('null','string') then
      raise exception 'Invalid mapping field: %', field;
    end if;
    if jsonb_typeof(p_layout -> field) = 'string' then
      begin
        role_id := (p_layout ->> field)::uuid;
      exception when invalid_text_representation then
        raise exception 'Invalid role UUID in field %', field;
      end;
      if not exists (select 1 from public.job_types where id = role_id) then
        raise exception 'Unknown role in field %', field;
      end if;
    end if;
  end loop;
  insert into public.schedule_excel_export_layout(id, layout, updated_at, updated_by)
  values (1, p_layout, now(), auth.uid())
  on conflict (id) do update set layout = excluded.layout,
    updated_at = excluded.updated_at, updated_by = excluded.updated_by;
end $$;
revoke all on function public.get_schedule_excel_export_layout() from public;
revoke all on function public.save_schedule_excel_export_layout(jsonb) from public;
grant execute on function public.get_schedule_excel_export_layout() to authenticated;
grant execute on function public.save_schedule_excel_export_layout(jsonb) to authenticated;
