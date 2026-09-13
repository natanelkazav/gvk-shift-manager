# Dynamic Cutover Readiness Audit — Phase 8.8

## Decision
The dynamic Job Type runtime is the target product. GVK legacy roles (`dispatcher`, `on_call`, `morning_driver`) are compatibility/import sources only and must not define runtime behavior for a dynamic Job Type.

## Cutover rule
When an authenticated user has at least one active dynamic Job Type membership, employee-facing runtime prefers the dynamic experience for every capability that exists for that Job Type. Legacy routes remain directly reachable during the pilot only as rollback/compatibility paths. They are not the source of truth after cutover.

A user may belong to multiple Job Types. Runtime capability is evaluated per Job Type/materialized month, not by `profiles.role` and not by the Job Type name.

## Audited dynamic runtime
The following runtime areas are generic and must remain free of GVK legacy-role branching:
- Dynamic dashboard/runtime context
- My dynamic availability
- My dynamic shifts
- Dynamic shift exchange
- Generic role workspace / period workflow
- Generic draft editor
- Dynamic statistics
- Dynamic scheduling runtime service and runtime context types

`npm run audit:dynamic-runtime` enforces this boundary.

## Allowed legacy boundary
Legacy-specific identifiers are still expected in legacy services/pages, historical migrations, import adapters, archive/export code deferred to the AI phase, and transition inbox code that must surface pending legacy requests until cutover is complete.

These are compatibility boundaries, not reusable product architecture.

## Remaining blockers before GVK production cutover
1. GVK legacy-to-Job-Type migration adapter with preview/idempotency and no hard-coded destination UUIDs.
2. Full end-to-end QA across multiple Job Types, permissions, current/next month, PWA/mobile and multi-role users.
3. Final notification/push matrix across the whole product (explicitly deferred).
4. Cutover switch/cleanup: hide legacy employee navigation for migrated users, preserve rollback/direct legacy access during pilot, then remove legacy role assignments only after sign-off.
5. Generic import/export/archive is intentionally deferred to the AI phase.

## Removal gate
Do not delete legacy tables, migrations or historical data as part of cutover. First remove legacy assignments/navigation dependencies, observe the pilot, and only later decide whether legacy runtime code can be retired.

## Audit finding: legacy import type boundary
`DynamicLegacySourceKind` remains in `src/types/dynamicScheduling.ts` because the current GVK import bridge accepts the three historical source systems. This is permitted only as migration-adapter vocabulary and must not be used to choose runtime behavior. The future GVK migration adapter should move this contract into a dedicated legacy/import module.
