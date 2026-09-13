# Dynamic Job Types & Scheduling Engine — Phase 1

Phase 1 is intentionally additive and inactive.

## Core split
- **Schedule Group** owns the shared shift pool and calendar/day rules.
- **Job Type** describes an employment variant participating in that pool.
- Multiple job types can therefore compete for the **same shift instances** (for example full-time and part-time dispatchers).

## Safety
`dynamic_job_types` is seeded as `enabled=false`, `mode=shadow`.
No existing RPC, enum, `profiles.role`, scheduling table, availability flow, publication flow, swap flow, statistics flow, or payroll flow reads the new model in Phase 1.

## Future AI boundary
AI suggestions are stored in `job_type_ai_suggestions` for human review. They cannot grant permissions or modify scheduling merely by being created. Future phases will validate suggestions against a capability/permission registry before an approved configuration can be applied.

## Historical rule
Templates are configuration. Published schedule instances must retain their actual times/pay snapshots so later template edits never rewrite history.
