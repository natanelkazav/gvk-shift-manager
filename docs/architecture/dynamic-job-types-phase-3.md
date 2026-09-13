# Dynamic Job Types – Phase 3: Schedule Group Editor

Phase 3 adds a real editor for the new `schedule_groups` configuration while the production scheduling engine remains untouched.

## What can now be configured

- Weekday, Friday and Saturday shift templates.
- Holiday eve, full holiday, holiday end and Chol HaMoed behavior.
- A day can use its own templates, inherit another day family, or have no work.
- Start/end time per shift.
- Minimum / target / maximum workers per shift.
- Partial pay segments inside a shift, such as 14:00–16:00 at ×1 and 16:00–22:00 at ×2.
- Monthly preview against the real `calendar_special_days` table.
- Version history snapshots on every save.

## Legacy shadow mapping

Phase 3 completes a shadow representation of the three current schedule pools:

- Dispatch center: weekday / Friday / Saturday / holiday-full templates and the intended pay segments.
- Morning on-call: weekday morning, weekday evening and Friday morning; holiday eve inherits Friday, holiday full/end are no-work.
- On-call: represented as an all-day schedule pool for future generic-engine migration.

## Safety

`dynamic_job_types` stays `enabled=false`, `mode=shadow`.

No current availability, draft creation, publishing, swaps, payroll, statistics or published history reads these definitions yet. Preview is read-only and saves only configuration/version snapshots.
