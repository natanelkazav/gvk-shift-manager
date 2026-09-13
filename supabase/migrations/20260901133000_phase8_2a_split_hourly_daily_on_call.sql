begin;

-- Phase 8.2A refinement: distinguish hourly and full-day on-call structures.
-- Existing `on_call` definitions represented time windows, so they migrate safely
-- to `on_call_hourly`. Full-day on-call is an explicit new option.
--
-- NOTE: dynamic job types are stored in public.job_types. Effective-month
-- versions store their configuration inside the `snapshot` JSONB document.

update public.job_types
set scheduling_config = jsonb_set(
  coalesce(scheduling_config, '{}'::jsonb),
  '{shiftPattern,workMode}',
  '"on_call_hourly"'::jsonb,
  true
)
where scheduling_config #>> '{shiftPattern,workMode}' = 'on_call';

update public.job_type_configuration_versions
set snapshot = jsonb_set(
  snapshot,
  '{schedulingConfig,shiftPattern,workMode}',
  '"on_call_hourly"'::jsonb,
  true
)
where snapshot #>> '{schedulingConfig,shiftPattern,workMode}' = 'on_call';

comment on table public.job_types is
  'Dynamic job types. scheduling_config.shiftPattern.workMode supports shifts, on_call_hourly, and on_call_daily.';

commit;
