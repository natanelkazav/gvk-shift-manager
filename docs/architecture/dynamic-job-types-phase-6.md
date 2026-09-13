# Dynamic Job Types — Phase 6

Phase 6 connects the generic availability model to an administrator-facing Shadow workspace.

## What can be tested

For a materialized Shadow month an administrator can select any member of the Job Type, set monthly min/target/max capacity, mark every generated shift using the statuses enabled by the Job Type, and save the submission entirely to the Dynamic Shadow tables. The Phase-5 feasibility analyzer and optimizer consume these values directly.

This creates the first end-to-end generic path:

Schedule Group → Job Type → Shadow Availability → Capacity → Feasibility → Proportional Targets → Shadow Draft.

## Legacy comparison

The tester can compare structural counts against the current dispatcher system (shift count, participating users, availability rows). Other legacy roles deliberately report comparison as not yet automated rather than guessing across their older specialized schemas. Their comparison will be added when those flows are migrated.

## Production safety

No production availability RPC or table is replaced. No employee sees these Shadow submissions. No notification is sent. `dynamic_job_types` remains disabled and `mode=shadow`.
