-- =========================================================
-- Live hotfix: reopened dispatcher workflow + manager edits
-- =========================================================
-- 1. Allow a previously published dispatcher month to return to
--    scheduling when managers reopen availability and save a new draft.
-- 2. Allow schedule.edit users to correct published schedules in the
--    current month and the immediately following month.
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

    /*
     * A published month may intentionally return to the scheduling
     * workflow after its availability period was reopened and closed
     * again. Saving the new draft demotes the period to `scheduling`;
     * it must be explicitly published again before regular users see
     * the revised version. Archived months remain immutable.
     */
    if existing_schedule_period.status =
      'archived'::public.schedule_period_status
    then
      raise exception
        'archived schedules cannot be overwritten';
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


CREATE OR REPLACE FUNCTION public.update_current_schedule_shift(requested_shift_id uuid, requested_new_user_id uuid, requested_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_user_id uuid :=
    (select auth.uid());

  actor_display_name text;

  has_schedule_edit boolean :=
    false;

  target_shift
    public.schedule_shifts%rowtype;

  target_period
    public.schedule_periods%rowtype;

  previous_user_id uuid;
  previous_user_name text;
  new_user_name text;

  normalized_reason text :=
    nullif(
      trim(requested_reason),
      ''
    );

  old_notification_id uuid;
  new_notification_id uuid;

  notification_ids uuid[] :=
    array[]::uuid[];

  shift_label text;

  current_year integer;
  current_month integer;

  audit_summary text;
begin
  if actor_user_id is null then
    raise exception
      'not authenticated';
  end if;

  select
    profile.display_name
  into
    actor_display_name
  from public.profiles
    profile
  where profile.id =
      actor_user_id
    and profile.is_active =
      true;

  if actor_display_name is null then
    raise exception
      'user not active';
  end if;

  select exists (
    select 1
    from public.user_permissions
      permission
    where permission.user_id =
        actor_user_id
      and permission.permission_key =
        'schedule.edit'
  )
  into
    has_schedule_edit;

  if not has_schedule_edit then
    raise exception
      'schedule edit permission required';
  end if;

  select
    shift.*
  into
    target_shift
  from public.schedule_shifts
    shift
  where shift.id =
      requested_shift_id
  for update;

  if not found then
    raise exception
      'schedule shift not found';
  end if;

  select
    period.*
  into
    target_period
  from public.schedule_periods
    period
  where period.id =
      target_shift.period_id;

  if not found then
    raise exception
      'schedule period not found';
  end if;

  current_year :=
    to_char(
      timezone(
        'Asia/Jerusalem',
        now()
      ),
      'YYYY'
    )::integer;

  current_month :=
    to_char(
      timezone(
        'Asia/Jerusalem',
        now()
      ),
      'MM'
    )::integer;

  /*
   * A user with schedule.edit may correct a published dispatcher
   * schedule in the current month or in the immediately following
   * month. Older and more distant future schedules remain read-only.
   */
  if (
    target_period.year * 12 +
    target_period.month - 1
  ) not in (
    current_year * 12 +
      current_month - 1,
    current_year * 12 +
      current_month
  ) then
    raise exception
      'only current or next month schedule can be edited';
  end if;

  if target_period.status <>
      'published'
  then
    raise exception
      'only published current or next month schedule can be edited';
  end if;

  select
    coalesce(
      profile.schedule_name,
      profile.display_name
    )
  into
    new_user_name
  from public.profiles
    profile
  where profile.id =
      requested_new_user_id
    and profile.is_active =
      true
    and profile.role =
      'dispatcher';

  if new_user_name is null then
    raise exception
      'target dispatcher is not active';
  end if;

  previous_user_id :=
    target_shift.assigned_user_id;

  if previous_user_id is not null then
    select
      coalesce(
        profile.schedule_name,
        profile.display_name
      )
    into
      previous_user_name
    from public.profiles
      profile
    where profile.id =
        previous_user_id;
  end if;

  if previous_user_id =
      requested_new_user_id
  then
    raise exception
      'dispatcher is already assigned to this shift';
  end if;

  if exists (
    select 1
    from public.schedule_shifts
      other_shift
    where other_shift.period_id =
        target_shift.period_id

      and other_shift.id <>
        target_shift.id

      and other_shift.assigned_user_id =
        requested_new_user_id

      and (
        (
          other_shift.starts_at <
            target_shift.ends_at

          and other_shift.ends_at >
            target_shift.starts_at
        )

        or

        other_shift.ends_at =
          target_shift.starts_at

        or

        other_shift.starts_at =
          target_shift.ends_at
      )
  ) then
    raise exception
      'target dispatcher has overlapping or consecutive shift';
  end if;

  update public.schedule_shifts
  set
    assigned_user_id =
      requested_new_user_id,

    assignment_source =
      'manual',

    updated_at =
      now()
  where id =
      target_shift.id;

  /*
   * ה-trigger של schedule_shifts יוצר את רשומת
   * schedule_assignment_history.
   * אם נמסרה סיבה, אנחנו מוסיפים אותה לרשומה
   * שנוצרה עכשיו.
   */
  if normalized_reason is not null then
    update public.schedule_assignment_history
      history
    set
      reason =
        normalized_reason
    where history.id = (
      select
        recent_history.id
      from public.schedule_assignment_history
        recent_history
      where recent_history.shift_id =
          target_shift.id

        and recent_history.changed_by =
          actor_user_id

        and recent_history.previous_user_id
          is not distinct from
            previous_user_id

        and recent_history.new_user_id =
          requested_new_user_id

      order by
        recent_history.created_at
          desc

      limit 1
    );
  end if;

  shift_label :=
    to_char(
      target_shift.shift_date,
      'DD/MM/YYYY'
    )
    ||
    ' '
    ||
    to_char(
      target_shift.starts_at
        at time zone
          'Asia/Jerusalem',
      'HH24:MI'
    )
    ||
    '–'
    ||
    to_char(
      target_shift.ends_at
        at time zone
          'Asia/Jerusalem',
      'HH24:MI'
    );

  /*
   * התראה למוקדן שהוסר מהמשמרת.
   */
  if previous_user_id is not null then
    insert into public.notifications (
      type,
      priority,
      source,
      title,
      body,
      url,
      data,
      created_by,
      expires_at
    )
    values (
      'system',
      'important',
      'schedule_edit',
      'שינוי בשיבוץ המשמרות',
      'הוסרת מהמשמרת '
        || shift_label
        || '. המוקדן החדש: '
        || new_user_name
        || '.',
      '/schedule',
      jsonb_build_object(
        'workflow',
          'schedule_edit',

        'event',
          'assignment_changed',

        'actorUserId',
          actor_user_id,

        'shiftId',
          target_shift.id,

        'previousUserId',
          previous_user_id,

        'newUserId',
          requested_new_user_id
      ),
      actor_user_id,
      now() +
        interval '90 days'
    )
    returning id
    into old_notification_id;

    insert into public.notification_recipients (
      notification_id,
      user_id
    )
    values (
      old_notification_id,
      previous_user_id
    );

    notification_ids :=
      array_append(
        notification_ids,
        old_notification_id
      );
  end if;

  /*
   * התראה למוקדן החדש.
   */
  insert into public.notifications (
    type,
    priority,
    source,
    title,
    body,
    url,
    data,
    created_by,
    expires_at
  )
  values (
    'system',
    'important',
    'schedule_edit',
    'שובצת למשמרת',
    'שובצת למשמרת '
      || shift_label
      || ' בעקבות שינוי בלוח.',
    '/schedule',
    jsonb_build_object(
      'workflow',
        'schedule_edit',

      'event',
        'assignment_changed',

      'actorUserId',
        actor_user_id,

      'shiftId',
        target_shift.id,

      'previousUserId',
        previous_user_id,

      'newUserId',
        requested_new_user_id
    ),
    actor_user_id,
    now() +
      interval '90 days'
  )
  returning id
  into new_notification_id;

  insert into public.notification_recipients (
    notification_id,
    user_id
  )
  values (
    new_notification_id,
    requested_new_user_id
  );

  notification_ids :=
    array_append(
      notification_ids,
      new_notification_id
    );

  /*
   * תיאור אנושי ליומן המערכת.
   * audit_logs.summary הוא NOT NULL.
   */
  audit_summary :=
    concat(
      'שינוי שיבוץ מוקדן: ',
      coalesce(
        previous_user_name,
        'ללא שיבוץ'
      ),
      ' → ',
      new_user_name,
      ' | ',
      shift_label,
      case
        when normalized_reason
          is not null
        then
          ' | סיבה: '
          || normalized_reason
        else
          ''
      end
    );

  insert into public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    summary,
    old_values,
    new_values,
    metadata
  )
  values (
    actor_user_id,
    'schedule.assignment.updated',
    'schedule_shift',
    target_shift.id,
    audit_summary,
    jsonb_build_object(
      'assignedUserId',
        previous_user_id,

      'assignedUserName',
        previous_user_name
    ),
    jsonb_build_object(
      'assignedUserId',
        requested_new_user_id,

      'assignedUserName',
        new_user_name
    ),
    jsonb_build_object(
      'reason',
        normalized_reason,

      'periodId',
        target_period.id,

      'year',
        target_period.year,

      'month',
        target_period.month,

      'actorDisplayName',
        actor_display_name
    )
  );

  return jsonb_build_object(
    'shiftId',
      target_shift.id,

    'previousUserId',
      previous_user_id,

    'previousUserName',
      previous_user_name,

    'newUserId',
      requested_new_user_id,

    'newUserName',
      new_user_name,

    'shiftDate',
      target_shift.shift_date,

    'startsAt',
      target_shift.starts_at,

    'endsAt',
      target_shift.ends_at,

    'notificationIds',
      to_jsonb(
        notification_ids
      )
  );
end;
$function$
