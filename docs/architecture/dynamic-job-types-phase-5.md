# Dynamic Job Types — Phase 5: Generic Scheduling & Optimization Engine

Phase 5 adds a **shadow-only** generic scheduling engine above the Phase-4 dynamic availability model.

## Pipeline

1. Feasibility Analyzer
2. Capacity / proportional-target calculation
3. Hard Rules
4. Coverage-first optimizer
5. Optional staffing toward target workers
6. Explanation / scoring snapshots

## Capacity behavior

Monthly minimum is configurable as `soft` or `hard`. In the default `soft` mode, if six employees request a minimum of 20 assignments each but only 80 required assignments exist, the engine does not fail silently. The feasibility report exposes the 40-assignment excess and computes proportional targets based on each employee's target/minimum, availability, and maximum capacity.

Monthly maximum defaults to a hard constraint. If aggregate maximum capacity is lower than required staffing, the feasibility report exposes the shortage before a draft is generated.

## Coverage priority

Required staffing (`min_workers`) is filled across the whole month before the optimizer attempts optional assignments up to `target_workers`. This generalizes the morning-driver coverage-first rule.

## Rules

The Phase-5 registry includes overlap protection, consecutive-shift protection, minimum rest, max shifts/day, monthly min/max, proportional fairness, night/weekend/holiday balance, and coverage priority.

Natural-language rules can be saved to the AI suggestion review queue. They are **not executable** and **never auto-apply**. Model-based interpretation is intentionally deferred to the AI Configurator phase.

## Safety

- `dynamic_job_types.enabled = false`
- mode remains `shadow`
- no production schedule table is written
- no existing schedule RPC is replaced
- no shadow draft can be published
