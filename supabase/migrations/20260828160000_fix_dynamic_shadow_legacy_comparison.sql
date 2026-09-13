begin;

-- Phase 6.1 hotfix:
-- The legacy dispatcher availability model no longer points directly to
-- schedule_shifts. It uses availability_periods + availability_shift_slots,
-- and dispatcher_availability references those slots through shift_slot_id.
-- Keep the Shadow comparison read-only and aligned with the current legacy
-- availability schema.

create or replace function public.compare_dynamic_availability_shadow_to_legacy(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  job public.job_types%rowtype;
  dynamic_period public.dynamic_availability_periods%rowtype;
  legacy_period_id uuid;
  dynamic_slots integer := 0;
  dynamic_members integer := 0;
  dynamic_entries integer := 0;
  legacy_slots integer := 0;
  legacy_entries integer := 0;
  legacy_members integer := 0;
  supported boolean := true;
  note text := null;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = current_user_id
      and up.permission_key in ('users.view', 'users.manage')
  ) then
    raise exception 'not allowed';
  end if;

  select *
  into job
  from public.job_types jt
  where jt.id = requested_job_type_id;

  if job.id is null then
    raise exception 'job type not found';
  end if;

  select *
  into dynamic_period
  from public.dynamic_availability_periods dap
  where dap.job_type_id = job.id
    and dap.year = requested_year
    and dap.month = requested_month;

  if dynamic_period.id is not null then
    select count(*)::integer
    into dynamic_slots
    from public.dynamic_availability_slots das
    where das.period_id = dynamic_period.id;

    select count(*)::integer
    into dynamic_members
    from public.job_type_memberships jtm
    where jtm.job_type_id = job.id;

    select count(*)::integer
    into dynamic_entries
    from public.dynamic_availability_entries dae
    join public.dynamic_availability_submissions dasub
      on dasub.id = dae.submission_id
    where dasub.period_id = dynamic_period.id;
  end if;

  if job.legacy_role = 'dispatcher' then
    select ap.id
    into legacy_period_id
    from public.availability_periods ap
    where ap.year = requested_year
      and ap.month = requested_month
    order by ap.created_at desc
    limit 1;

    if legacy_period_id is not null then
      select count(*)::integer
      into legacy_slots
      from public.availability_shift_slots ass
      where ass.period_id = legacy_period_id;

      select
        count(distinct da.user_id)::integer,
        count(*)::integer
      into
        legacy_members,
        legacy_entries
      from public.dispatcher_availability da
      where da.period_id = legacy_period_id;
    end if;
  else
    supported := false;
    note := 'השוואה אוטומטית מלאה ל־Legacy עבור סוג תפקיד זה תתווסף בזמן הסבת ה־flow הישן. נתוני ה־Dynamic עדיין מוצגים במלואם.';
  end if;

  return jsonb_build_object(
    'mode', 'shadow',
    'supported', supported,
    'legacyRole', job.legacy_role,
    'note', note,
    'dynamic', jsonb_build_object(
      'slots', dynamic_slots,
      'members', dynamic_members,
      'entries', dynamic_entries
    ),
    'legacy', jsonb_build_object(
      'slots', legacy_slots,
      'members', legacy_members,
      'entries', legacy_entries
    ),
    'slotDelta', dynamic_slots - legacy_slots,
    'memberDelta', dynamic_members - legacy_members,
    'entryDelta', dynamic_entries - legacy_entries
  );
end;
$function$;

revoke all on function public.compare_dynamic_availability_shadow_to_legacy(uuid, integer, integer) from public;
grant execute on function public.compare_dynamic_availability_shadow_to_legacy(uuid, integer, integer) to authenticated;

commit;
