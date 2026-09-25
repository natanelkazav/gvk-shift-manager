begin;

-- Flexible job-type memberships support three per-member employment scopes:
-- full_time, part_time and as_much_as_possible. Shadow targets still carried
-- the older Phase 7.1 constraint that only accepted the first two values,
-- causing draft creation to fail when a member selected "as much as possible".
alter table public.dynamic_schedule_shadow_targets
  drop constraint if exists dynamic_schedule_shadow_targets_employment_scope_valid;

alter table public.dynamic_schedule_shadow_targets
  add constraint dynamic_schedule_shadow_targets_employment_scope_valid
  check (
    employment_scope is null
    or employment_scope in ('full_time', 'part_time', 'as_much_as_possible')
  );

commit;
