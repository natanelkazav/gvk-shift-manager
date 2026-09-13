# Dynamic Job Types — Phase 4: Availability Engine

Phase 4 introduces a generic availability model while production availability flows remain untouched.

## Configuration per job type
A job type can define whether availability is enabled, allowed answers (available, unavailable, preferred, avoid), notes, monthly min/target/max capacity, and optional limits for nights, weekends and holidays.

## Shadow data model
`dynamic_availability_periods`, `dynamic_availability_slots`, `dynamic_availability_submissions`, and `dynamic_availability_entries` are isolated from the current dispatcher/driver/morning-driver tables. Direct authenticated table access is revoked while the feature is in shadow mode.

An administrator may materialize a shadow month from the Schedule Group preview. Slots snapshot their date, time, holiday/day classification, staffing requirement and pay segments so later configuration changes cannot rewrite that month's definition.

## Safety
No current availability RPC is replaced. `profiles.role` remains unchanged. No user is asked to submit through the generic engine. `dynamic_job_types.enabled` remains false and `mode=shadow`.

## Next phase
Phase 5 can consume these generic slots/submissions in a deterministic scheduling optimizer and compare its result with the legacy draft engines before any production cutover.
