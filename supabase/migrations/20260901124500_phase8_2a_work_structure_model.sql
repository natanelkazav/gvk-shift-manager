begin;

-- Phase 8.2A refinement: role work structure is explicitly either shifts or on-call.
-- Each day family can be disabled or contain multiple work windows.
-- scheduling_config remains JSONB, so this migration only upgrades existing Phase 8.2A values.

with normalized as (
  select
    jt.id,
    jsonb_set(
      jt.scheduling_config,
      '{shiftPattern}',
      jsonb_build_object(
        'enabled', coalesce((jt.scheduling_config #>> '{shiftPattern,enabled}')::boolean, true),
        'workMode', 'shifts',
        'weekday', jsonb_build_object(
          'works', true,
          'shifts', jsonb_build_array(jsonb_build_object(
            'id', 'weekday-1', 'name', 'משמרת 1',
            'startTime', coalesce(jt.scheduling_config #>> '{shiftPattern,weekday,startTime}', '08:00'),
            'endTime', coalesce(jt.scheduling_config #>> '{shiftPattern,weekday,endTime}', '17:00')
          ))
        ),
        'friday', jsonb_build_object(
          'works', true,
          'shifts', jsonb_build_array(jsonb_build_object(
            'id', 'friday-1', 'name', 'משמרת 1',
            'startTime', coalesce(jt.scheduling_config #>> '{shiftPattern,friday,startTime}', '08:00'),
            'endTime', coalesce(jt.scheduling_config #>> '{shiftPattern,friday,endTime}', '14:00')
          ))
        ),
        'saturday', jsonb_build_object(
          'works', true,
          'shifts', jsonb_build_array(jsonb_build_object(
            'id', 'saturday-1', 'name', 'משמרת 1',
            'startTime', coalesce(jt.scheduling_config #>> '{shiftPattern,saturday,startTime}', '08:00'),
            'endTime', coalesce(jt.scheduling_config #>> '{shiftPattern,saturday,endTime}', '17:00')
          ))
        ),
        'holiday', jsonb_build_object(
          'works', true,
          'shifts', jsonb_build_array(jsonb_build_object(
            'id', 'holiday-1', 'name', 'משמרת 1',
            'startTime', coalesce(jt.scheduling_config #>> '{shiftPattern,holiday,startTime}', '08:00'),
            'endTime', coalesce(jt.scheduling_config #>> '{shiftPattern,holiday,endTime}', '17:00')
          ))
        )
      ),
      true
    ) as scheduling_config
  from public.job_types jt
  where jt.scheduling_config ? 'shiftPattern'
    and not (jt.scheduling_config #> '{shiftPattern}' ? 'workMode')
)
update public.job_types jt
set scheduling_config = normalized.scheduling_config
from normalized
where jt.id = normalized.id;

-- Existing effective-month snapshots are intentionally left untouched: the client normalizes
-- the old one-window representation when a historical/future configuration is opened, and
-- the next save writes the new representation without rewriting audit history.

commit;
