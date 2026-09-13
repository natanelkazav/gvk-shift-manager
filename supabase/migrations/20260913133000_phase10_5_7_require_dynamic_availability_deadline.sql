-- Phase 10.5.7: require a submission deadline before a Dynamic availability period can be opened.
-- This keeps the rule generic for every Dynamic Job Type and protects non-UI callers as well.

begin;

create or replace function public.enforce_dynamic_availability_open_deadline()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'open' and new.submission_deadline is null then
    raise exception 'submission deadline is required before opening dynamic availability period';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_dynamic_availability_open_deadline
  on public.dynamic_availability_periods;

create trigger trg_dynamic_availability_open_deadline
before insert or update of status, submission_deadline
on public.dynamic_availability_periods
for each row
execute function public.enforce_dynamic_availability_open_deadline();

commit;
