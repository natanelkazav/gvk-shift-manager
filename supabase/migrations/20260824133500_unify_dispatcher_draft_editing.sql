-- קובץ: supabase/migrations/20260824133500_unify_dispatcher_draft_editing.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור מוקדנים / טיוטה.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_schedule_draft_edit_context, public.update_schedule_draft_shift.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- Unified dispatcher draft editing from the main schedule screen.

-- פונקציית מסד public.get_schedule_draft_edit_context: שליפה או חישוב של שיבוץ / טיוטה.
create or replace function public.get_schedule_draft_edit_context(
  requested_schedule_period_id uuid
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = ''
as $function$
declare
  -- current_user_id — המשתמש הנוכחי הנוכחי.
  current_user_id uuid := auth.uid();
  -- target_period — יעד / תקופה.
  target_period public.schedule_periods%rowtype;
  -- current_permissions — הרשאות.
  current_permissions text[];
begin
  -- הסתעפות לפי התנאי current_user_id is null.
  if current_user_id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not authenticated';
  end if;

  current_permissions := coalesce(public.get_my_permissions(), array[]::text[]);

  -- הסתעפות לפי התנאי not ('schedule.edit' = any(current_permissions)).
  if not ('schedule.edit' = any(current_permissions)) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  select *
  into target_period
  from public.schedule_periods period
  where period.id = requested_schedule_period_id;

  -- הסתעפות לפי התנאי not found.
  if not found then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'schedule period not found';
  end if;

  -- הסתעפות לפי התנאי target_period.status not in ('draft'::public.schedule_period_status, 'scheduling'::public.schedule_period_status).
  if target_period.status not in ('draft'::public.schedule_period_status, 'scheduling'::public.schedule_period_status) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'schedule period is not editable as draft';
  end if;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'periodId', target_period.id,
    'dispatchers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', profile.id,
          'displayName', profile.display_name,
          'scheduleName', profile.schedule_name
        )
        order by coalesce(profile.schedule_name, profile.display_name)
      )
      from public.profiles profile
      where profile.is_active = true
        and exists (
          select 1
          from public.user_permissions permission
          where permission.user_id = profile.id
            and permission.permission_key in ('availability.view', 'schedule.view')
        )
    ), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'scheduleShiftId', schedule_shift.id,
          'availabilityShiftSlotId', schedule_shift.availability_shift_slot_id,
          'availableCount', (
            select count(*)::integer
            from public.dispatcher_availability availability
            join public.profiles profile
              on profile.id = availability.user_id
             and profile.is_active = true
            where availability.period_id = target_period.availability_period_id
              and availability.shift_slot_id = schedule_shift.availability_shift_slot_id
              and availability.availability_status = 'available'
          ),
          'totalDispatchers', (
            select count(distinct profile.id)::integer
            from public.profiles profile
            join public.user_permissions permission
              on permission.user_id = profile.id
             and permission.permission_key in ('availability.view', 'schedule.view')
            where profile.is_active = true
          ),
          'candidates', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'userId', profile.id,
                'displayName', profile.display_name,
                'scheduleName', profile.schedule_name,
                'isAvailable', coalesce(availability.availability_status = 'available', false)
              )
              order by coalesce(profile.schedule_name, profile.display_name)
            )
            from public.profiles profile
            left join public.dispatcher_availability availability
              on availability.user_id = profile.id
             and availability.period_id = target_period.availability_period_id
             and availability.shift_slot_id = schedule_shift.availability_shift_slot_id
            where profile.is_active = true
              and exists (
                select 1
                from public.user_permissions permission
                where permission.user_id = profile.id
                  and permission.permission_key in ('availability.view', 'schedule.view')
              )
          ), '[]'::jsonb)
        )
        order by schedule_shift.starts_at
      )
      from public.schedule_shifts schedule_shift
      where schedule_shift.period_id = target_period.id
    ), '[]'::jsonb)
  );
end;
$function$;

-- פונקציית מסד public.update_schedule_draft_shift: עדכון שיבוץ / טיוטה / משמרת.
create or replace function public.update_schedule_draft_shift(
  requested_shift_id uuid,
  requested_new_user_id uuid default null,
  requested_intentionally_unassigned boolean default false
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = ''
as $function$
declare
  -- current_user_id — המשתמש הנוכחי הנוכחי.
  current_user_id uuid := auth.uid();
  -- current_permissions — הרשאות.
  current_permissions text[];
  -- target_shift — יעד / משמרת.
  target_shift public.schedule_shifts%rowtype;
  -- target_period — יעד / תקופה.
  target_period public.schedule_periods%rowtype;
  -- selected_name — נבחר / שם.
  selected_name text;
begin
  -- הסתעפות לפי התנאי current_user_id is null.
  if current_user_id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not authenticated';
  end if;

  current_permissions := coalesce(public.get_my_permissions(), array[]::text[]);
  -- הסתעפות לפי התנאי not ('schedule.edit' = any(current_permissions)).
  if not ('schedule.edit' = any(current_permissions)) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  select *
  into target_shift
  from public.schedule_shifts shift
  where shift.id = requested_shift_id
  for update;

  -- הסתעפות לפי התנאי not found.
  if not found then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'schedule shift not found';
  end if;

  select *
  into target_period
  from public.schedule_periods period
  where period.id = target_shift.period_id
  for update;

  -- הסתעפות לפי התנאי target_period.status not in ('draft'::public.schedule_period_status, 'scheduling'::public.schedule_period_status).
  if target_period.status not in ('draft'::public.schedule_period_status, 'scheduling'::public.schedule_period_status) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'only draft schedules can be edited with this action';
  end if;

  -- הסתעפות לפי התנאי requested_intentionally_unassigned.
  if requested_intentionally_unassigned then
    -- עדכון רשומות ב־public.schedule_shifts בהתאם לקלט ולתנאים להלן.
    update public.schedule_shifts
    set
      assigned_user_id = null,
      is_intentionally_unassigned = true,
      assignment_source = null,
      assignment_score = null,
      assignment_reasons = jsonb_build_array('המשמרת סומנה במפורש כלא מאוישת.'),
      updated_at = now()
    where id = target_shift.id;

    -- הרכבת תוצאת הפעולה והחזרתה לקורא.
    return jsonb_build_object(
      'shiftId', target_shift.id,
      'assignedUserId', null,
      'assignedUserName', null,
      'isIntentionallyUnassigned', true
    );
  end if;

  -- הסתעפות לפי התנאי requested_new_user_id is null.
  if requested_new_user_id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'new user id is required';
  end if;

  select coalesce(profile.schedule_name, profile.display_name)
  into selected_name
  from public.profiles profile
  where profile.id = requested_new_user_id
    and profile.is_active = true
    and exists (
      select 1
      from public.user_permissions permission
      where permission.user_id = profile.id
        and permission.permission_key in ('availability.view', 'schedule.view')
    );

  -- הסתעפות לפי התנאי selected_name is null.
  if selected_name is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'selected dispatcher is missing or inactive';
  end if;

  -- הסתעפות לפי התנאי exists (.
  if exists (
    select 1
    from public.schedule_shifts other_shift
    where other_shift.period_id = target_shift.period_id
      and other_shift.id <> target_shift.id
      and other_shift.assigned_user_id = requested_new_user_id
      and other_shift.starts_at < target_shift.ends_at
      and other_shift.ends_at > target_shift.starts_at
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'the selected dispatcher has an overlapping shift';
  end if;

  -- הסתעפות לפי התנאי exists (.
  if exists (
    select 1
    from public.schedule_shifts other_shift
    where other_shift.period_id = target_shift.period_id
      and other_shift.id <> target_shift.id
      and other_shift.assigned_user_id = requested_new_user_id
      and (
        other_shift.ends_at = target_shift.starts_at
        or other_shift.starts_at = target_shift.ends_at
      )
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'the selected dispatcher has a consecutive shift';
  end if;

  -- עדכון רשומות ב־public.schedule_shifts בהתאם לקלט ולתנאים להלן.
  update public.schedule_shifts
  set
    assigned_user_id = requested_new_user_id,
    is_intentionally_unassigned = false,
    assignment_source = 'manual'::public.assignment_source,
    assignment_score = null,
    assignment_reasons = jsonb_build_array('שיבוץ ידני מתוך מסך עריכת הטיוטה.'),
    updated_at = now()
  where id = target_shift.id;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'shiftId', target_shift.id,
    'assignedUserId', requested_new_user_id,
    'assignedUserName', selected_name,
    'isIntentionallyUnassigned', false
  );
end;
$function$;
