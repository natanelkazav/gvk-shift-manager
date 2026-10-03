begin;

-- The original materialization table uses the *_work_mode_valid constraint name.
-- "none" is a valid work mode for capability-only roles such as Activity Tracking.
alter table public.job_type_schedule_materializations
  drop constraint if exists job_type_schedule_materializations_work_mode_check;

alter table public.job_type_schedule_materializations
  drop constraint if exists job_type_schedule_materializations_work_mode_valid;

alter table public.job_type_schedule_materializations
  add constraint job_type_schedule_materializations_work_mode_valid
  check (work_mode in ('none','shifts','on_call_hourly','on_call_daily'));

comment on constraint job_type_schedule_materializations_work_mode_valid
  on public.job_type_schedule_materializations is
  'Allows scheduling work modes plus none for job types that use capabilities without a schedule.';

commit;
