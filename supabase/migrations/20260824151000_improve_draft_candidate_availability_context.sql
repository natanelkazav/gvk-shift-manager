-- =========================================================
-- Improve dispatcher draft candidate availability context.
--
-- "availableCount" now means dispatchers who explicitly marked
-- themselves as available. Automatically completed availability
-- is kept separate so the UI does not present it as a user choice.
-- =========================================================

create or replace function public.get_schedule_draft_edit_context(
  requested_schedule_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  target_period public.schedule_periods%rowtype;
  current_permissions text[];
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  current_permissions :=
    coalesce(
      public.get_my_permissions(),
      array[]::text[]
    );

  if not (
    'schedule.edit' =
      any(current_permissions)
  ) then
    raise exception 'not allowed';
  end if;

  select *
  into target_period
  from public.schedule_periods period
  where period.id =
    requested_schedule_period_id;

  if not found then
    raise exception
      'schedule period not found';
  end if;

  if target_period.status not in (
    'draft'::public.schedule_period_status,
    'scheduling'::public.schedule_period_status
  ) then
    raise exception
      'schedule period is not editable as draft';
  end if;

  return jsonb_build_object(
    'periodId',
      target_period.id,

    'dispatchers',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id',
                profile.id,
              'displayName',
                profile.display_name,
              'scheduleName',
                profile.schedule_name
            )
            order by
              coalesce(
                profile.schedule_name,
                profile.display_name
              )
          )
          from public.profiles profile
          where profile.is_active = true
            and profile.role::text = 'dispatcher'
        ),
        '[]'::jsonb
      ),

    'shifts',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'scheduleShiftId',
                schedule_shift.id,

              'availabilityShiftSlotId',
                schedule_shift.availability_shift_slot_id,

              /*
               * Count only availability the dispatcher explicitly chose.
               * Auto-completed "available" entries are not a declaration.
               */
              'availableCount',
                (
                  select count(*)::integer
                  from public.dispatcher_availability availability
                  join public.profiles profile
                    on profile.id =
                      availability.user_id
                   and profile.is_active = true
                   and profile.role::text =
                     'dispatcher'
                  where availability.period_id =
                      target_period.availability_period_id
                    and availability.shift_slot_id =
                      schedule_shift.availability_shift_slot_id
                    and availability.availability_status =
                      'available'
                    and coalesce(
                      availability.is_auto_completed,
                      false
                    ) = false
                ),

              'totalDispatchers',
                (
                  select count(*)::integer
                  from public.profiles profile
                  where profile.is_active = true
                    and profile.role::text =
                      'dispatcher'
                ),

              'candidates',
                coalesce(
                  (
                    select jsonb_agg(
                      jsonb_build_object(
                        'userId',
                          profile.id,
                        'displayName',
                          profile.display_name,
                        'scheduleName',
                          profile.schedule_name,

                        /*
                         * isAvailable means an explicit declaration.
                         */
                        'isAvailable',
                          coalesce(
                            availability.availability_status =
                              'available'
                            and not coalesce(
                              availability.is_auto_completed,
                              false
                            ),
                            false
                          ),

                        'availabilityStatus',
                          availability.availability_status,

                        'isAutoCompleted',
                          coalesce(
                            availability.is_auto_completed,
                            false
                          )
                      )
                      order by
                        case
                          when availability.availability_status =
                                 'available'
                            and not coalesce(
                              availability.is_auto_completed,
                              false
                            )
                          then 1

                          when availability.availability_status =
                                 'unavailable'
                          then 2

                          else 3
                        end,

                        coalesce(
                          profile.schedule_name,
                          profile.display_name
                        )
                    )
                    from public.profiles profile
                    left join public.dispatcher_availability availability
                      on availability.user_id =
                        profile.id
                     and availability.period_id =
                        target_period.availability_period_id
                     and availability.shift_slot_id =
                        schedule_shift.availability_shift_slot_id
                    where profile.is_active = true
                      and profile.role::text =
                        'dispatcher'
                  ),
                  '[]'::jsonb
                )
            )
            order by
              schedule_shift.starts_at
          )
          from public.schedule_shifts schedule_shift
          where schedule_shift.period_id =
            target_period.id
        ),
        '[]'::jsonb
      )
  );
end;
$function$;
