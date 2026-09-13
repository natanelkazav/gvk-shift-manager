# Dynamic Job Types — Phase 2

Phase 2 exposes the additive Phase-1 scheduling model inside **User Management**.

## What is live in Phase 2

- Read-only overview of schedule groups and their mapped shift templates.
- Read/write job-type configuration for users with `users.manage`.
- Employment scope and payroll-model metadata.
- Capability configuration.
- Default-permission configuration.
- Existing dispatcher / on-call / morning-driver defaults are seeded into the new model.

## What is intentionally NOT live yet

- `profiles.role` remains the production source used by the existing application.
- Creating a job type does not create availability periods or schedules.
- Default permissions are not automatically applied to new users yet.
- Job-type capabilities do not activate production features yet.
- The generic schedule engine is not enabled.
- AI suggestions are not invoked or automatically applied.

The `dynamic_job_types` feature flag remains disabled and in `shadow` mode.
