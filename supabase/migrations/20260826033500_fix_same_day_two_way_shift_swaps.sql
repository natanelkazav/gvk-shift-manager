-- =========================================================
-- Fix two-way dispatcher swaps for adjacent shifts
-- =========================================================
--
-- A two-way swap must be validated against the final state of
-- the SAME published schedule period only. The previous validator
-- loaded every shift ever assigned to the two dispatchers, which
-- could create false consecutive/overlap conflicts from unrelated
-- months.
--
-- Example that must be allowed when there are no other conflicts:
--   Adam  16:00-23:00  <->  Omer 23:00-06:00
-- becomes:
--   Omer  16:00-23:00
--   Adam  23:00-06:00
-- =========================================================

create or replace function public.validate_shift_swap_final_state(
  requested_swap_type text,
  requested_requester_user_id uuid,
  requested_counterparty_user_id uuid,
  requested_requester_shift_id uuid,
  requested_counterparty_shift_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  requester_shift public.schedule_shifts%rowtype;
  counterparty_shift public.schedule_shifts%rowtype;
  target_period_id uuid;
  conflict_record record;
begin
  -- =======================================================
  -- 1. Basic input validation
  -- =======================================================

  if requested_swap_type not in ('one_way', 'two_way') then
    return jsonb_build_object(
      'valid', false,
      'code', 'invalid_swap_type',
      'message', 'סוג ההחלפה אינו תקין.'
    );
  end if;

  if requested_requester_user_id is null
    or requested_counterparty_user_id is null
    or requested_requester_user_id = requested_counterparty_user_id
  then
    return jsonb_build_object(
      'valid', false,
      'code', 'invalid_users',
      'message', 'יש לבחור שני מוקדנים שונים.'
    );
  end if;

  if requested_requester_shift_id is null then
    return jsonb_build_object(
      'valid', false,
      'code', 'missing_requester_shift',
      'message', 'יש לבחור את המשמרת שלך.'
    );
  end if;

  if requested_swap_type = 'two_way'
    and requested_counterparty_shift_id is null
  then
    return jsonb_build_object(
      'valid', false,
      'code', 'missing_counterparty_shift',
      'message', 'בהחלפה דו-כיוונית יש לבחור משמרת של המוקדן השני.'
    );
  end if;

  if requested_swap_type = 'two_way'
    and requested_counterparty_shift_id = requested_requester_shift_id
  then
    return jsonb_build_object(
      'valid', false,
      'code', 'same_shift',
      'message', 'יש לבחור שתי משמרות שונות להחלפה.'
    );
  end if;

  -- =======================================================
  -- 2. Resolve the actual schedule period and current owners
  -- =======================================================

  select *
  into requester_shift
  from public.schedule_shifts shift_row
  where shift_row.id = requested_requester_shift_id;

  if not found then
    return jsonb_build_object(
      'valid', false,
      'code', 'requester_shift_not_found',
      'message', 'המשמרת שלך לא נמצאה.'
    );
  end if;

  if requester_shift.assigned_user_id
    is distinct from requested_requester_user_id
  then
    return jsonb_build_object(
      'valid', false,
      'code', 'requester_shift_owner_changed',
      'message', 'השיבוץ של המשמרת שלך השתנה. יש לרענן ולנסות שוב.'
    );
  end if;

  target_period_id := requester_shift.period_id;

  if requested_swap_type = 'two_way' then
    select *
    into counterparty_shift
    from public.schedule_shifts shift_row
    where shift_row.id = requested_counterparty_shift_id;

    if not found then
      return jsonb_build_object(
        'valid', false,
        'code', 'counterparty_shift_not_found',
        'message', 'המשמרת של המוקדן השני לא נמצאה.'
      );
    end if;

    if counterparty_shift.period_id is distinct from target_period_id then
      return jsonb_build_object(
        'valid', false,
        'code', 'different_schedule_periods',
        'message', 'בהחלפה דו-כיוונית שתי המשמרות חייבות להיות מאותו חודש שיבוץ.'
      );
    end if;

    if counterparty_shift.assigned_user_id
      is distinct from requested_counterparty_user_id
    then
      return jsonb_build_object(
        'valid', false,
        'code', 'counterparty_shift_owner_changed',
        'message', 'השיבוץ של המוקדן השני השתנה. יש לרענן ולנסות שוב.'
      );
    end if;
  end if;

  -- =======================================================
  -- 3. Simulate the FINAL state of this schedule period
  -- =======================================================
  --
  -- Important:
  -- - Only shifts from target_period_id participate.
  -- - The two selected shifts are reassigned before checking.
  -- - Therefore two adjacent shifts that are exchanged between
  --   two dispatchers do NOT conflict with each other after the
  --   swap, because each dispatcher owns only one of them.
  -- =======================================================

  with simulated_assignments as (
    select
      shift_row.id,
      shift_row.starts_at,
      shift_row.ends_at,
      case
        when shift_row.id = requested_requester_shift_id
          then requested_counterparty_user_id

        when requested_swap_type = 'two_way'
          and shift_row.id = requested_counterparty_shift_id
          then requested_requester_user_id

        else shift_row.assigned_user_id
      end as simulated_user_id

    from public.schedule_shifts shift_row

    where shift_row.period_id = target_period_id
      and (
        shift_row.assigned_user_id in (
          requested_requester_user_id,
          requested_counterparty_user_id
        )
        or shift_row.id = requested_requester_shift_id
        or (
          requested_swap_type = 'two_way'
          and shift_row.id = requested_counterparty_shift_id
        )
      )
  ),

  relevant as (
    select *
    from simulated_assignments
    where simulated_user_id in (
      requested_requester_user_id,
      requested_counterparty_user_id
    )
  ),

  conflicts as (
    select
      first_shift.simulated_user_id as user_id,
      first_shift.id as first_shift_id,
      second_shift.id as second_shift_id,
      first_shift.starts_at as first_starts_at,
      first_shift.ends_at as first_ends_at,
      second_shift.starts_at as second_starts_at,
      second_shift.ends_at as second_ends_at,
      case
        when second_shift.starts_at < first_shift.ends_at
          then 'overlapping_shifts'
        else 'consecutive_shifts'
      end as conflict_type

    from relevant first_shift

    join relevant second_shift
      on second_shift.simulated_user_id = first_shift.simulated_user_id
      and second_shift.id <> first_shift.id
      and second_shift.starts_at >= first_shift.starts_at
      and (
        second_shift.starts_at < first_shift.ends_at
        or second_shift.starts_at = first_shift.ends_at
      )

    order by
      first_shift.starts_at,
      second_shift.starts_at

    limit 1
  )

  select *
  into conflict_record
  from conflicts;

  if found then
    return jsonb_build_object(
      'valid', false,
      'code', conflict_record.conflict_type,
      'message',
        case
          when conflict_record.conflict_type = 'overlapping_shifts'
            then 'ההחלפה יוצרת חפיפה בין משמרות של אחד המוקדנים.'
          else 'ההחלפה יוצרת משמרות רצופות לאותו מוקדן.'
        end,
      'userId', conflict_record.user_id,
      'firstShiftId', conflict_record.first_shift_id,
      'secondShiftId', conflict_record.second_shift_id
    );
  end if;

  return jsonb_build_object(
    'valid', true,
    'code', null,
    'message', null
  );
end;
$function$;


grant execute
on function public.validate_shift_swap_final_state(
  text,
  uuid,
  uuid,
  uuid,
  uuid
)
to authenticated;
