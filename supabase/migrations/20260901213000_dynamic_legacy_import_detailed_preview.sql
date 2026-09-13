begin;

create or replace function public.preview_dynamic_legacy_import(
  requested_job_type_id uuid,
  requested_source_kind text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  periods_count integer := 0;
  assignments_count integer := 0;
  availability_count integer := 0;
  imported_periods integer := 0;
  imported_assignments integer := 0;
  imported_availability integer := 0;
  expected_role text;
  period_details jsonb := '[]'::jsonb;
  user_details jsonb := '[]'::jsonb;
  issues jsonb := '[]'::jsonb;
  referenced_users integer := 0;
  missing_profiles integer := 0;
  role_mismatches integer := 0;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from public.user_permissions up
    where up.user_id = current_user_id
      and up.permission_key = 'users.manage'
  ) then
    raise exception 'not allowed';
  end if;

  if requested_source_kind not in ('dispatcher','on_call','morning_driver') then
    raise exception 'invalid source kind';
  end if;

  if not exists (select 1 from public.job_types where id = requested_job_type_id) then
    raise exception 'job type not found';
  end if;

  if requested_source_kind = 'dispatcher' then
    expected_role := 'dispatcher';

    select count(*)::integer into periods_count
    from public.schedule_periods p
    where p.status::text in ('published','archived');

    select count(*)::integer into assignments_count
    from public.schedule_shifts s
    join public.schedule_periods p on p.id = s.period_id
    where p.status::text in ('published','archived');

    select count(*)::integer into availability_count
    from public.dispatcher_availability a
    join public.availability_periods ap on ap.id = a.period_id
    join public.availability_shift_slots slot on slot.id = a.shift_slot_id
    where exists (
      select 1 from public.schedule_periods p
      where p.year = ap.year and p.month = ap.month
        and p.status::text in ('published','archived')
    );

    select coalesce(jsonb_agg(jsonb_build_object(
      'sourcePeriodId', p.id,
      'year', p.year,
      'month', p.month,
      'label', lpad(p.month::text,2,'0') || '/' || p.year::text,
      'status', p.status::text,
      'assignments', (select count(*) from public.schedule_shifts s where s.period_id=p.id),
      'availability', (
        select count(*)
        from public.dispatcher_availability a
        join public.availability_periods ap on ap.id=a.period_id
        where ap.year=p.year and ap.month=p.month
      ),
      'alreadyImported', exists(
        select 1 from public.dynamic_historical_periods hp
        where hp.job_type_id=requested_job_type_id
          and hp.source_kind='dispatcher'
          and hp.source_period_id=p.id
      )
    ) order by p.year,p.month),'[]'::jsonb)
    into period_details
    from public.schedule_periods p
    where p.status::text in ('published','archived');

    with legacy_user_ids as (
      select s.assigned_user_id as user_id
      from public.schedule_shifts s
      join public.schedule_periods p on p.id=s.period_id
      where p.status::text in ('published','archived') and s.assigned_user_id is not null
      union
      select a.user_id
      from public.dispatcher_availability a
      join public.availability_periods ap on ap.id=a.period_id
      where exists (
        select 1 from public.schedule_periods p
        where p.year=ap.year and p.month=ap.month
          and p.status::text in ('published','archived')
      )
    )
    select
      count(*)::integer,
      count(*) filter (where p.id is null)::integer,
      count(*) filter (where p.id is not null and p.role::text <> expected_role)::integer,
      coalesce(jsonb_agg(jsonb_build_object(
        'userId', u.user_id,
        'displayName', coalesce(p.display_name,'משתמש שלא נמצא'),
        'email', p.email,
        'legacyRole', case when p.id is null then null else p.role::text end,
        'expectedLegacyRole', expected_role,
        'isActive', coalesce(p.is_active,false),
        'isAlreadyMember', exists(
          select 1 from public.job_type_memberships jm
          where jm.job_type_id=requested_job_type_id and jm.user_id=u.user_id
        ),
        'status', case
          when p.id is null then 'missing_profile'
          when p.role::text <> expected_role then 'role_mismatch'
          else 'matched'
        end
      ) order by coalesce(p.display_name,u.user_id::text)),'[]'::jsonb)
    into referenced_users, missing_profiles, role_mismatches, user_details
    from legacy_user_ids u
    left join public.profiles p on p.id=u.user_id;

  elsif requested_source_kind = 'on_call' then
    expected_role := 'on_call';

    select count(*)::integer into periods_count
    from public.driver_schedule_periods p where p.status::text in ('published','archived');

    select count(*)::integer into assignments_count
    from public.driver_schedule_days d
    join public.driver_schedule_periods p on p.id=d.period_id
    where p.status::text in ('published','archived');

    select coalesce(jsonb_agg(jsonb_build_object(
      'sourcePeriodId', p.id,
      'year', p.year,
      'month', p.month,
      'label', lpad(p.month::text,2,'0') || '/' || p.year::text,
      'status', p.status::text,
      'assignments', (select count(*) from public.driver_schedule_days d where d.period_id=p.id),
      'availability', 0,
      'alreadyImported', exists(
        select 1 from public.dynamic_historical_periods hp
        where hp.job_type_id=requested_job_type_id
          and hp.source_kind='on_call'
          and hp.source_period_id=p.id
      )
    ) order by p.year,p.month),'[]'::jsonb)
    into period_details
    from public.driver_schedule_periods p
    where p.status::text in ('published','archived');

    with legacy_user_ids as (
      select d.assigned_user_id as user_id
      from public.driver_schedule_days d
      join public.driver_schedule_periods p on p.id=d.period_id
      where p.status::text in ('published','archived') and d.assigned_user_id is not null
      union
      select d.original_user_id
      from public.driver_schedule_days d
      join public.driver_schedule_periods p on p.id=d.period_id
      where p.status::text in ('published','archived') and d.original_user_id is not null
    )
    select
      count(*)::integer,
      count(*) filter (where p.id is null)::integer,
      count(*) filter (where p.id is not null and p.role::text <> expected_role)::integer,
      coalesce(jsonb_agg(jsonb_build_object(
        'userId', u.user_id,
        'displayName', coalesce(p.display_name,'משתמש שלא נמצא'),
        'email', p.email,
        'legacyRole', case when p.id is null then null else p.role::text end,
        'expectedLegacyRole', expected_role,
        'isActive', coalesce(p.is_active,false),
        'isAlreadyMember', exists(
          select 1 from public.job_type_memberships jm
          where jm.job_type_id=requested_job_type_id and jm.user_id=u.user_id
        ),
        'status', case when p.id is null then 'missing_profile' when p.role::text<>expected_role then 'role_mismatch' else 'matched' end
      ) order by coalesce(p.display_name,u.user_id::text)),'[]'::jsonb)
    into referenced_users, missing_profiles, role_mismatches, user_details
    from legacy_user_ids u
    left join public.profiles p on p.id=u.user_id;

  else
    expected_role := 'morning_driver';

    select count(*)::integer into periods_count
    from public.morning_driver_schedule_periods p where p.status::text in ('published','archived');

    select count(*)::integer into assignments_count
    from public.morning_driver_schedule_assignments a
    join public.morning_driver_schedule_periods p on p.id=a.schedule_period_id
    where p.status::text in ('published','archived');

    select count(*)::integer into availability_count
    from public.morning_driver_availability_entries e
    join public.morning_driver_schedule_periods sp on sp.availability_period_id=e.period_id
    where sp.status::text in ('published','archived');

    select coalesce(jsonb_agg(jsonb_build_object(
      'sourcePeriodId', p.id,
      'year', p.year,
      'month', p.month,
      'label', lpad(p.month::text,2,'0') || '/' || p.year::text,
      'status', p.status::text,
      'assignments', (select count(*) from public.morning_driver_schedule_assignments a where a.schedule_period_id=p.id),
      'availability', (
        select count(*) from public.morning_driver_availability_entries e
        where e.period_id=p.availability_period_id
      ),
      'alreadyImported', exists(
        select 1 from public.dynamic_historical_periods hp
        where hp.job_type_id=requested_job_type_id
          and hp.source_kind='morning_driver'
          and hp.source_period_id=p.id
      )
    ) order by p.year,p.month),'[]'::jsonb)
    into period_details
    from public.morning_driver_schedule_periods p
    where p.status::text in ('published','archived');

    with legacy_user_ids as (
      select a.assigned_user_id as user_id
      from public.morning_driver_schedule_assignments a
      join public.morning_driver_schedule_periods p on p.id=a.schedule_period_id
      where p.status::text in ('published','archived') and a.assigned_user_id is not null
      union
      select e.user_id
      from public.morning_driver_availability_entries e
      join public.morning_driver_schedule_periods sp on sp.availability_period_id=e.period_id
      where sp.status::text in ('published','archived')
    )
    select
      count(*)::integer,
      count(*) filter (where p.id is null)::integer,
      count(*) filter (where p.id is not null and p.role::text <> expected_role)::integer,
      coalesce(jsonb_agg(jsonb_build_object(
        'userId', u.user_id,
        'displayName', coalesce(p.display_name,'משתמש שלא נמצא'),
        'email', p.email,
        'legacyRole', case when p.id is null then null else p.role::text end,
        'expectedLegacyRole', expected_role,
        'isActive', coalesce(p.is_active,false),
        'isAlreadyMember', exists(
          select 1 from public.job_type_memberships jm
          where jm.job_type_id=requested_job_type_id and jm.user_id=u.user_id
        ),
        'status', case when p.id is null then 'missing_profile' when p.role::text<>expected_role then 'role_mismatch' else 'matched' end
      ) order by coalesce(p.display_name,u.user_id::text)),'[]'::jsonb)
    into referenced_users, missing_profiles, role_mismatches, user_details
    from legacy_user_ids u
    left join public.profiles p on p.id=u.user_id;
  end if;

  select count(*)::integer into imported_periods
  from public.dynamic_historical_periods
  where job_type_id=requested_job_type_id and source_kind=requested_source_kind;

  select count(*)::integer into imported_assignments
  from public.dynamic_historical_assignments a
  join public.dynamic_historical_periods p on p.id=a.historical_period_id
  where p.job_type_id=requested_job_type_id and a.source_kind=requested_source_kind;

  select count(*)::integer into imported_availability
  from public.dynamic_historical_availability a
  join public.dynamic_historical_periods p on p.id=a.historical_period_id
  where p.job_type_id=requested_job_type_id and a.source_kind=requested_source_kind;

  if periods_count = 0 then
    issues := issues || jsonb_build_array(jsonb_build_object('severity','warning','code','no_periods','message','לא נמצאו תקופות מפורסמות או ארכיוניות במערכת המקור'));
  end if;
  if missing_profiles > 0 then
    issues := issues || jsonb_build_array(jsonb_build_object('severity','error','code','missing_profiles','message',missing_profiles::text || ' משתמשים שמופיעים בהיסטוריה אינם קיימים עוד בטבלת המשתמשים'));
  end if;
  if role_mismatches > 0 then
    issues := issues || jsonb_build_array(jsonb_build_object('severity','warning','code','role_mismatch','message',role_mismatches::text || ' משתמשים היסטוריים קיימים אך ה-role הישן שלהם השתנה'));
  end if;

  return jsonb_build_object(
    'sourceKind', requested_source_kind,
    'expectedLegacyRole', expected_role,
    'periods', periods_count,
    'assignments', assignments_count,
    'availability', availability_count,
    'alreadyImportedPeriods', imported_periods,
    'alreadyImportedAssignments', imported_assignments,
    'alreadyImportedAvailability', imported_availability,
    'newPeriods', greatest(periods_count-imported_periods,0),
    'newAssignments', greatest(assignments_count-imported_assignments,0),
    'newAvailability', greatest(availability_count-imported_availability,0),
    'matchingUsers', (select count(*) from public.profiles p where p.role::text=expected_role),
    'referencedUsers', referenced_users,
    'missingProfiles', missing_profiles,
    'roleMismatches', role_mismatches,
    'periodDetails', period_details,
    'userDetails', user_details,
    'issues', issues,
    'canImport', periods_count > 0 and missing_profiles = 0,
    'warning', 'הייבוא מעתיק היסטוריה בלבד ואינו מוחק או משנה נתונים במערכת הישנה'
  );
end;
$function$;

revoke all on function public.preview_dynamic_legacy_import(uuid,text) from public;
grant execute on function public.preview_dynamic_legacy_import(uuid,text) to authenticated;

commit;
