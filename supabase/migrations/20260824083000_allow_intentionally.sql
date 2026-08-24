-- =========================================================
-- Intentionally unassigned dispatcher shifts
--
-- מאפשר למנהל לסמן משמרת במפורש כ"לא מאוישת",
-- לשמור אותה בטיוטה ולפרסם את הלוח למרות שאין מוקדן.
--
-- משמרת ריקה שלא סומנה במפורש עדיין תחסום פרסום.
-- =========================================================


-- =========================================================
-- 1. הוספת השדה למשמרות
-- =========================================================

alter table public.schedule_shifts
add column if not exists
  is_intentionally_unassigned boolean
  not null
  default false;


-- =========================================================
-- 2. הגנת עקביות במסד
--
-- משמרת לא יכולה להיות גם משויכת למוקדן וגם מסומנת
-- במפורש כ"לא מאוישת".
-- =========================================================

alter table public.schedule_shifts
drop constraint if exists
  schedule_shifts_intentionally_unassigned_check;

alter table public.schedule_shifts
add constraint
  schedule_shifts_intentionally_unassigned_check
check (
  not is_intentionally_unassigned
  or assigned_user_id is null
);


-- =========================================================
-- 3. שמירת טיוטת שיבוץ
-- =========================================================

create or replace function public.save_schedule_draft(
  requested_availability_period_id uuid,
  requested_assignments jsonb,
  requested_confirm_warnings boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid;

  source_period
    public.availability_periods%rowtype;

  existing_schedule_period
    public.schedule_periods%rowtype;

  resolved_schedule_period_id uuid;

  source_shift_count integer;
  payload_count integer;
  distinct_payload_count integer;

  inactive_user_count integer;
  unavailable_assignment_count integer := 0;

  overlap_count integer;
  consecutive_count integer;

  saved_shift_count integer;
  automatic_assignment_count integer;
  manual_assignment_count integer;
  intentionally_unassigned_count integer;
begin
  current_user_id :=
    auth.uid();

  if current_user_id is null then
    raise exception
      'not authenticated';
  end if;


  -- =======================================================
  -- 1. הרשאות
  -- =======================================================

  if not exists (
    select 1
    from public.profiles profile
    where profile.id =
      current_user_id
      and profile.is_active = true
  ) then
    raise exception
      'user not active';
  end if;

  if not (
    'schedule.edit' = any(
      coalesce(
        public.get_my_permissions(),
        array[]::text[]
      )
    )
  ) then
    raise exception
      'not allowed';
  end if;


  -- =======================================================
  -- 2. בדיקת קלט
  -- =======================================================

  if requested_availability_period_id
    is null
  then
    raise exception
      'availability period id is required';
  end if;

  if requested_assignments is null
    or jsonb_typeof(
      requested_assignments
    ) <> 'array'
  then
    raise exception
      'assignments must be a json array';
  end if;


  -- =======================================================
  -- 3. תקופת האילוצים
  -- =======================================================

  select *
  into source_period
  from public.availability_periods
  where id =
    requested_availability_period_id;

  if not found then
    raise exception
      'availability period not found';
  end if;

  if source_period.status <> 'closed' then
    raise exception
      'availability period must be closed';
  end if;

  select count(*)
  into source_shift_count
  from public.availability_shift_slots
  where period_id =
    requested_availability_period_id;

  if source_shift_count = 0 then
    raise exception
      'availability period has no shift slots';
  end if;

  payload_count :=
    jsonb_array_length(
      requested_assignments
    );

  if payload_count = 0 then
    raise exception
      'assignments array is empty';
  end if;


  -- =======================================================
  -- 4. בדיקת מבנה האובייקטים
  --
  -- משמרת רגילה:
  --   shiftId + userId + source
  --
  -- משמרת שסומנה במכוון כלא מאוישת:
  --   shiftId + isIntentionallyUnassigned=true
  -- =======================================================

  if exists (
    select 1
    from jsonb_array_elements(
      requested_assignments
    ) item
    where
      jsonb_typeof(item) <> 'object'

      or nullif(
        btrim(
          item ->> 'shiftId'
        ),
        ''
      ) is null

      or (
        coalesce(
          (
            item ->
            'isIntentionallyUnassigned'
          )::boolean,
          false
        ) = false

        and nullif(
          btrim(
            item ->> 'userId'
          ),
          ''
        ) is null
      )

      or (
        coalesce(
          (
            item ->
            'isIntentionallyUnassigned'
          )::boolean,
          false
        ) = false

        and nullif(
          btrim(
            item ->> 'source'
          ),
          ''
        ) is null
      )
  ) then
    raise exception
      'one or more assignment objects are invalid';
  end if;


  if exists (
    select 1
    from jsonb_array_elements(
      requested_assignments
    ) item
    where
      item ->> 'source' is not null

      and item ->> 'source'
        not in (
          'automatic_single_candidate',
          'automatic_scoring',
          'manual',
          'automatic',
          'shift_swap',
          'import'
        )
  ) then
    raise exception
      'unsupported assignment source';
  end if;


  -- =======================================================
  -- 5. מניעת UUID לא תקין
  -- =======================================================

  if exists (
    select 1
    from jsonb_array_elements(
      requested_assignments
    ) item
    where
      not (
        item ->> 'shiftId'
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )

      or (
        coalesce(
          (
            item ->
            'isIntentionallyUnassigned'
          )::boolean,
          false
        ) = false

        and not (
          item ->> 'userId'
          ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        )
      )
  ) then
    raise exception
      'one or more assignment identifiers are invalid';
  end if;


  -- =======================================================
  -- 6. כפילויות ושלמות
  -- =======================================================

  select
    count(
      distinct (
        item ->> 'shiftId'
      )
    )
  into
    distinct_payload_count
  from jsonb_array_elements(
    requested_assignments
  ) item;

  if distinct_payload_count
    <> payload_count
  then
    raise exception
      'duplicate shift assignments were received';
  end if;


  /*
   * גם משמרת שסומנה במכוון כלא מאוישת צריכה
   * להופיע ב-payload כאובייקט.
   */
  if payload_count
    <> source_shift_count
  then
    raise exception
      'every availability shift must have exactly one assignment';
  end if;


  /*
   * מוודאים שכל shiftId באמת שייך לתקופת האילוצים.
   */
  if exists (
    with payload as (
      select
        (
          item ->> 'shiftId'
        )::uuid as shift_id
      from jsonb_array_elements(
        requested_assignments
      ) item
    )

    select 1
    from payload

    left join
      public.availability_shift_slots slot
      on slot.id =
        payload.shift_id

      and slot.period_id =
        requested_availability_period_id

    where slot.id is null
  ) then
    raise exception
      'one or more shifts do not belong to the requested availability period';
  end if;


  /*
   * מוודאים שאף משמרת מהתקופה לא חסרה מה-payload.
   */
  if exists (
    select 1

    from public.availability_shift_slots slot

    where slot.period_id =
      requested_availability_period_id

      and not exists (
        select 1

        from jsonb_array_elements(
          requested_assignments
        ) item

        where (
          item ->> 'shiftId'
        )::uuid =
          slot.id
      )
  ) then
    raise exception
      'one or more availability shifts are missing from the draft';
  end if;


  -- =======================================================
  -- 7. בדיקת מוקדנים פעילים
  --
  -- משמרת לא מאוישת במכוון לא נבדקת מול profiles.
  -- =======================================================

  with payload as (
    select distinct
      (
        item ->> 'userId'
      )::uuid as user_id

    from jsonb_array_elements(
      requested_assignments
    ) item

    where coalesce(
      (
        item ->
        'isIntentionallyUnassigned'
      )::boolean,
      false
    ) = false
  )

  select
    count(*)
  into
    inactive_user_count

  from payload

  left join public.profiles profile
    on profile.id =
      payload.user_id

  where
    profile.id is null
    or profile.is_active = false;


  if inactive_user_count > 0 then
    raise exception
      'one or more assigned dispatchers are missing or inactive';
  end if;


  -- =======================================================
  -- 8. אזהרות זמינות
  --
  -- הסכמה בפועל:
  -- dispatcher_availability.availability_status
  --
  -- אין צורך ב-Dynamic SQL.
  -- משמרת שסומנה כלא מאוישת אינה נבדקת.
  -- =======================================================

  with payload as (
    select
      (
        item ->> 'shiftId'
      )::uuid as shift_id,

      (
        item ->> 'userId'
      )::uuid as user_id

    from jsonb_array_elements(
      requested_assignments
    ) item

    where coalesce(
      (
        item ->
        'isIntentionallyUnassigned'
      )::boolean,
      false
    ) = false
  )

  select
    count(*)
  into
    unavailable_assignment_count

  from payload

  left join
    public.dispatcher_availability
      availability

    on availability.period_id =
      requested_availability_period_id

    and availability.shift_slot_id =
      payload.shift_id

    and availability.user_id =
      payload.user_id

  where
    availability.user_id is null

    or availability.availability_status
      <> 'available';


  if unavailable_assignment_count > 0
    and not requested_confirm_warnings
  then
    raise exception
      'availability warnings require confirmation';
  end if;


  -- =======================================================
  -- 9. בדיקת חפיפות ומשמרות רצופות
  --
  -- רק משמרות שבאמת משויכות למוקדן.
  -- =======================================================

  with payload as (
    select
      (
        item ->> 'shiftId'
      )::uuid as shift_id,

      (
        item ->> 'userId'
      )::uuid as user_id

    from jsonb_array_elements(
      requested_assignments
    ) item

    where coalesce(
      (
        item ->
        'isIntentionallyUnassigned'
      )::boolean,
      false
    ) = false
  ),

  intervals as (
    select
      payload.shift_id,
      payload.user_id,

      (
        slot.shift_date +
        slot.start_time
      ) at time zone
        'Asia/Jerusalem'
        as starts_at,

      (
        slot.shift_date +
        slot.end_time +

        case
          when slot.ends_next_day
            or slot.end_time <=
              slot.start_time

          then interval '1 day'
          else interval '0 day'
        end

      ) at time zone
        'Asia/Jerusalem'
        as ends_at

    from payload

    join public.availability_shift_slots slot
      on slot.id =
        payload.shift_id

      and slot.period_id =
        requested_availability_period_id
  ),

  ordered as (
    select
      intervals.*,

      lag(
        shift_id
      ) over (
        partition by user_id
        order by starts_at
      ) as previous_shift_id,

      lag(
        ends_at
      ) over (
        partition by user_id
        order by starts_at
      ) as previous_ends_at

    from intervals
  )

  select
    count(*) filter (
      where
        previous_ends_at is not null

        and starts_at <
          previous_ends_at
    ),

    count(*) filter (
      where
        previous_ends_at is not null

        and starts_at =
          previous_ends_at
    )

  into
    overlap_count,
    consecutive_count

  from ordered;


  if overlap_count > 0 then
    raise exception
      'the schedule contains overlapping shifts';
  end if;


  if consecutive_count > 0 then
    raise exception
      'the schedule contains consecutive shifts';
  end if;


  -- =======================================================
  -- 10. איתור או יצירת תקופת השיבוץ
  -- =======================================================

  select *
  into existing_schedule_period

  from public.schedule_periods

  where year =
      source_period.year

    and month =
      source_period.month

  for update;


  if found then

    if existing_schedule_period.status
      in (
        'published',
        'archived'
      )
    then
      raise exception
        'published or archived schedules cannot be overwritten';
    end if;


    resolved_schedule_period_id :=
      existing_schedule_period.id;


    update public.schedule_periods

    set
      availability_period_id =
        source_period.id,

      title =
        coalesce(
          source_period.title,

          concat(
            'שיבוץ ',
            source_period.month,
            '/',
            source_period.year
          )
        ),

      status =
        'scheduling'
          ::public.schedule_period_status,

      availability_deadline =
        source_period.submission_deadline,

      approved_by =
        current_user_id,

      approved_at =
        now(),

      updated_at =
        now()

    where id =
      resolved_schedule_period_id;


  else

    insert into public.schedule_periods (
      year,
      month,
      status,
      availability_deadline,
      availability_period_id,
      title,
      created_by,
      approved_by,
      approved_at
    )
    values (
      source_period.year,

      source_period.month,

      'scheduling'
        ::public.schedule_period_status,

      source_period.submission_deadline,

      source_period.id,

      coalesce(
        source_period.title,

        concat(
          'שיבוץ ',
          source_period.month,
          '/',
          source_period.year
        )
      ),

      current_user_id,
      current_user_id,
      now()
    )

    returning id
    into resolved_schedule_period_id;

  end if;


  -- =======================================================
  -- 11. שמירת המשמרות
  -- =======================================================

  insert into public.schedule_shifts (
    period_id,
    availability_shift_slot_id,
    shift_date,
    starts_at,
    ends_at,
    shift_code,
    schedule_type,
    is_premium,
    holiday_name,
    assigned_user_id,
    is_intentionally_unassigned,
    assignment_source,
    assignment_score,
    assignment_reasons,
    is_locked,
    notes
  )

  select
    resolved_schedule_period_id,

    slot.id,

    slot.shift_date,

    (
      slot.shift_date +
      slot.start_time
    ) at time zone
      'Asia/Jerusalem',

    (
      slot.shift_date +
      slot.end_time +

      case
        when slot.ends_next_day
          or slot.end_time <=
            slot.start_time

        then interval '1 day'
        else interval '0 day'
      end

    ) at time zone
      'Asia/Jerusalem',

    concat(
      to_char(
        slot.shift_date,
        'YYYYMMDD'
      ),
      '-',
      to_char(
        slot.start_time,
        'HH24MI'
      )
    ),

    slot.schedule_type
      ::public.schedule_type,

    slot.is_premium,

    slot.holiday_name,


    /*
     * מוקדן משויך.
     * אם המשמרת לא מאוישת במכוון - NULL.
     */
    case
      when coalesce(
        (
          item ->
          'isIntentionallyUnassigned'
        )::boolean,
        false
      )
      then null

      else (
        item ->> 'userId'
      )::uuid
    end,


    /*
     * סימון מפורש של משמרת לא מאוישת.
     */
    coalesce(
      (
        item ->
        'isIntentionallyUnassigned'
      )::boolean,
      false
    ),


    /*
     * מקור השיבוץ.
     * למשמרת לא מאוישת אין assignment_source.
     */
    case
      when coalesce(
        (
          item ->
          'isIntentionallyUnassigned'
        )::boolean,
        false
      )
      then null


      when item ->> 'source'
        in (
          'automatic_single_candidate',
          'automatic_scoring',
          'automatic'
        )
      then
        'automatic'
          ::public.assignment_source


      when item ->> 'source' =
        'shift_swap'
      then
        'shift_swap'
          ::public.assignment_source


      when item ->> 'source' =
        'import'
      then
        'import'
          ::public.assignment_source


      else
        'manual'
          ::public.assignment_source
    end,


    /*
     * ציון שיבוץ.
     */
    case
      when coalesce(
        (
          item ->
          'isIntentionallyUnassigned'
        )::boolean,
        false
      )
      then null

      when nullif(
        item ->> 'score',
        ''
      ) is null
      then null

      else (
        item ->> 'score'
      )::numeric
    end,


    /*
     * סיבות השיבוץ.
     */
    case
      when jsonb_typeof(
        item -> 'reasons'
      ) = 'array'

      then item -> 'reasons'

      else '[]'::jsonb
    end,


    false,


    /*
     * notes - גרסה קריאה של reasons.
     */
    case
      when jsonb_typeof(
        item -> 'reasons'
      ) = 'array'
      then (
        select
          string_agg(
            reason_value,
            E'\n'
          )

        from jsonb_array_elements_text(
          item -> 'reasons'
        ) reason_value
      )

      else null
    end


  from jsonb_array_elements(
    requested_assignments
  ) item


  join public.availability_shift_slots slot

    on slot.id =
      (
        item ->> 'shiftId'
      )::uuid

    and slot.period_id =
      requested_availability_period_id


  on conflict (
    period_id,
    starts_at
  )

  do update set

    availability_shift_slot_id =
      excluded.availability_shift_slot_id,

    shift_date =
      excluded.shift_date,

    ends_at =
      excluded.ends_at,

    shift_code =
      excluded.shift_code,

    schedule_type =
      excluded.schedule_type,

    is_premium =
      excluded.is_premium,

    holiday_name =
      excluded.holiday_name,

    assigned_user_id =
      excluded.assigned_user_id,

    is_intentionally_unassigned =
      excluded.is_intentionally_unassigned,

    assignment_source =
      excluded.assignment_source,

    assignment_score =
      excluded.assignment_score,

    assignment_reasons =
      excluded.assignment_reasons,

    is_locked =
      false,

    notes =
      excluded.notes,

    updated_at =
      now();


  -- =======================================================
  -- 12. בדיקת תוצאת השמירה
  -- =======================================================

  select
    count(*)

  into
    saved_shift_count

  from public.schedule_shifts shift

  where shift.period_id =
      resolved_schedule_period_id

    and shift.availability_shift_slot_id
      in (
        select slot.id

        from public.availability_shift_slots slot

        where slot.period_id =
          requested_availability_period_id
      );


  if saved_shift_count
    <> source_shift_count
  then
    raise exception
      'saved shift count does not match source shift count';
  end if;


  select
    count(*) filter (
      where shift.assignment_source =
        'automatic'
    ),

    count(*) filter (
      where shift.assignment_source =
        'manual'
    ),

    count(*) filter (
      where
        shift.is_intentionally_unassigned
    )

  into
    automatic_assignment_count,
    manual_assignment_count,
    intentionally_unassigned_count

  from public.schedule_shifts shift

  where shift.period_id =
    resolved_schedule_period_id;


  -- =======================================================
  -- 13. תשובה ללקוח
  -- =======================================================

  return jsonb_build_object(

    'schedulePeriodId',
      resolved_schedule_period_id,

    'availabilityPeriodId',
      requested_availability_period_id,

    'year',
      source_period.year,

    'month',
      source_period.month,

    'status',
      'scheduling',

    'savedShifts',
      saved_shift_count,

    'automaticAssignments',
      automatic_assignment_count,

    'manualAssignments',
      manual_assignment_count,

    'intentionallyUnassignedShifts',
      intentionally_unassigned_count,

    'warningCount',
      unavailable_assignment_count,

    'approvedBy',
      current_user_id,

    'approvedAt',
      now()
  );
end;
$function$;


-- =========================================================
-- 4. פרסום שיבוץ
--
-- משמרת ללא מוקדן:
--
-- is_intentionally_unassigned = false
--   => חוסמת פרסום.
--
-- is_intentionally_unassigned = true
--   => מותר לפרסם.
-- =========================================================

create or replace function public.publish_schedule_period(
  requested_schedule_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid;

  current_profile
    public.profiles%rowtype;

  target_period
    public.schedule_periods%rowtype;

  user_permissions text[];

  total_shift_count integer;
  unassigned_shift_count integer;
  intentionally_unassigned_shift_count integer;
  invalid_shift_count integer;
begin
  current_user_id :=
    auth.uid();


  if current_user_id is null then
    raise exception
      'not authenticated';
  end if;


  select *
  into current_profile

  from public.profiles

  where id =
    current_user_id;


  if not found then
    raise exception
      'profile not found';
  end if;


  if not current_profile.is_active then
    raise exception
      'user not active';
  end if;


  user_permissions :=
    coalesce(
      public.get_my_permissions(),
      array[]::text[]
    );


  if not (
    'schedule.edit' =
      any(user_permissions)
  ) then
    raise exception
      'not allowed';
  end if;


  if requested_schedule_period_id
    is null
  then
    raise exception
      'schedule period id is required';
  end if;


  select *
  into target_period

  from public.schedule_periods

  where id =
    requested_schedule_period_id

  for update;


  if not found then
    raise exception
      'schedule period not found';
  end if;


  if target_period.status =
    'archived'
      ::public.schedule_period_status
  then
    raise exception
      'archived schedule cannot be published';
  end if;


  if target_period.status =
    'published'
      ::public.schedule_period_status
  then
    return jsonb_build_object(

      'schedulePeriodId',
        target_period.id,

      'year',
        target_period.year,

      'month',
        target_period.month,

      'status',
        target_period.status::text,

      'publishedAt',
        target_period.published_at,

      'publishedBy',
        null,

      'publishedShifts',
        null,

      'intentionallyUnassignedShifts',
        (
          select count(*)

          from public.schedule_shifts shift

          where shift.period_id =
              target_period.id

            and shift.is_intentionally_unassigned
        ),

      'alreadyPublished',
        true
    );
  end if;


  if target_period.status
    not in (
      'draft'
        ::public.schedule_period_status,

      'scheduling'
        ::public.schedule_period_status
    )
  then
    raise exception
      'schedule is not ready for publication';
  end if;


  -- =======================================================
  -- בדיקת שלמות הלוח
  -- =======================================================

  select

    count(*)::integer,


    /*
     * ריקה בטעות - חוסמת פרסום.
     */
    count(*) filter (
      where
        assigned_user_id is null

        and not
          is_intentionally_unassigned
    )::integer,


    /*
     * ריקה במכוון - מותרת.
     */
    count(*) filter (
      where
        assigned_user_id is null

        and
          is_intentionally_unassigned
    )::integer,


    /*
     * תאריכים לא תקינים.
     */
    count(*) filter (
      where
        starts_at is null

        or ends_at is null

        or ends_at <=
          starts_at
    )::integer


  into
    total_shift_count,
    unassigned_shift_count,
    intentionally_unassigned_shift_count,
    invalid_shift_count


  from public.schedule_shifts

  where period_id =
    target_period.id;


  if total_shift_count = 0 then
    raise exception
      'schedule has no shifts';
  end if;


  if unassigned_shift_count > 0 then
    raise exception
      'schedule contains unassigned shifts';
  end if;


  if invalid_shift_count > 0 then
    raise exception
      'schedule contains invalid shifts';
  end if;


  -- =======================================================
  -- בדיקת חפיפות
  -- =======================================================

  if exists (
    select 1

    from public.schedule_shifts
      first_shift

    join public.schedule_shifts
      second_shift

      on second_shift.period_id =
        first_shift.period_id

      and second_shift.assigned_user_id =
        first_shift.assigned_user_id

      and second_shift.id >
        first_shift.id

      and second_shift.starts_at <
        first_shift.ends_at

      and second_shift.ends_at >
        first_shift.starts_at


    where first_shift.period_id =
        target_period.id

      and first_shift.assigned_user_id
        is not null
  ) then
    raise exception
      'schedule contains overlapping shifts';
  end if;


  -- =======================================================
  -- בדיקת משמרות רצופות
  -- =======================================================

  if exists (
    select 1

    from public.schedule_shifts
      first_shift

    join public.schedule_shifts
      second_shift

      on second_shift.period_id =
        first_shift.period_id

      and second_shift.assigned_user_id =
        first_shift.assigned_user_id

      and second_shift.starts_at =
        first_shift.ends_at


    where first_shift.period_id =
        target_period.id

      and first_shift.assigned_user_id
        is not null
  ) then
    raise exception
      'schedule contains consecutive shifts';
  end if;


  -- =======================================================
  -- פרסום
  -- =======================================================

  update public.schedule_periods

  set
    status =
      'published'
        ::public.schedule_period_status,

    published_at =
      now(),

    approved_by =
      current_user_id,

    approved_at =
      coalesce(
        approved_at,
        now()
      ),

    updated_at =
      now()


  where id =
    target_period.id


  returning *
  into target_period;


  return jsonb_build_object(

    'schedulePeriodId',
      target_period.id,

    'year',
      target_period.year,

    'month',
      target_period.month,

    'status',
      target_period.status::text,

    'publishedAt',
      target_period.published_at,

    'publishedBy',
      current_user_id,

    'publishedShifts',
      total_shift_count,

    'intentionallyUnassignedShifts',
      intentionally_unassigned_shift_count,

    'alreadyPublished',
      false
  );
end;
$function$;


-- =========================================================
-- 5. קריאת לוח מוקדנים לפי חודש
--
-- כולל:
-- - סדר כרונולוגי
-- - isIntentionallyUnassigned
-- =========================================================

create or replace function public.get_dispatcher_schedule_by_month(
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requesting_user_id uuid;

  current_permissions text[];

  selected_period
    public.schedule_periods%rowtype;

  can_view_team boolean :=
    false;

  can_view_personal boolean :=
    false;
begin
  requesting_user_id :=
    auth.uid();


  if requesting_user_id
    is null
  then
    raise exception
      'Authentication is required.';
  end if;


  if not exists (
    select 1

    from public.profiles

    where id =
        requesting_user_id

      and is_active = true
  ) then
    raise exception
      'Active user profile was not found.';
  end if;


  current_permissions :=
    coalesce(
      public.get_my_permissions(),
      array[]::text[]
    );


  can_view_team :=
    (
      'schedule.view_team' =
        any(current_permissions)

      or

      'schedule.edit' =
        any(current_permissions)
    );


  can_view_personal :=
    (
      'schedule.view' =
        any(current_permissions)
    );


  if not (
    can_view_team
    or can_view_personal
  ) then
    raise exception
      'not allowed';
  end if;


  if requested_year < 2020
    or requested_year > 2100
  then
    raise exception
      'Invalid schedule year.';
  end if;


  if requested_month < 1
    or requested_month > 12
  then
    raise exception
      'Invalid schedule month.';
  end if;


  select *
  into selected_period

  from public.schedule_periods

  where year =
      requested_year

    and month =
      requested_month

  limit 1;


  if not found then
    return jsonb_build_object(
      'period',
        null,

      'shifts',
        '[]'::jsonb
    );
  end if;


  /*
   * משתמש שרואה רק את הלוח האישי לא מקבל
   * טיוטה או חודש שעדיין לא פורסם.
   */
  if (
    not can_view_team

    and selected_period.status
      not in (
        'published',
        'archived'
      )
  ) then
    return jsonb_build_object(
      'period',
        null,

      'shifts',
        '[]'::jsonb
    );
  end if;


  return jsonb_build_object(

    'period',
      jsonb_build_object(

        'id',
          selected_period.id,

        'year',
          selected_period.year,

        'month',
          selected_period.month,

        'status',
          selected_period.status,

        'publishedAt',
          selected_period.published_at,

        'createdAt',
          selected_period.created_at,

        'updatedAt',
          selected_period.updated_at
      ),


    'shifts',
      coalesce(
        (
          select jsonb_agg(

            jsonb_build_object(

              'id',
                shift.id,

              'periodId',
                shift.period_id,

              'shiftDate',
                shift.shift_date,

              'startsAt',
                shift.starts_at,

              'endsAt',
                shift.ends_at,

              'shiftCode',
                shift.shift_code,

              'scheduleType',
                shift.schedule_type,

              'isPremium',
                shift.is_premium,

              'holidayName',
                shift.holiday_name,

              'assignedUserId',
                shift.assigned_user_id,

              'assignedUserName',
                coalesce(
                  assigned_profile.schedule_name,
                  assigned_profile.display_name
                ),

              'isIntentionallyUnassigned',
                shift.is_intentionally_unassigned,

              'isLocked',
                shift.is_locked,

              'notes',
                shift.notes
            )

            /*
             * סדר כרונולוגי אמיתי.
             */
            order by
              shift.shift_date asc,
              shift.starts_at asc
          )


          from public.schedule_shifts
            shift


          left join public.profiles
            assigned_profile

            on assigned_profile.id =
              shift.assigned_user_id


          where shift.period_id =
              selected_period.id

            and (
              can_view_team

              or shift.assigned_user_id =
                requesting_user_id
            )
        ),

        '[]'::jsonb
      )
  );
end;
$function$;