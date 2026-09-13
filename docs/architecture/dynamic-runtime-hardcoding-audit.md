# Phase 8.5 — Generic Dynamic Runtime / Hard-coding Audit

## Decision
The production scheduling runtime is job-type driven. It must not know the GVK legacy identities `dispatcher`, `on_call`, or `morning_driver`.
Those identities are allowed only in explicitly transitional legacy/import/compatibility code until GVK cutover is complete.

`schedule_group` is not a business role. It is an internal generic scheduling primitive and may remain where it models reusable scheduling structure. New runtime behavior must prefer `job_type_id`, effective-month materialization and job-type configuration.

## Dynamic-first cutover rule
When GVK cutover is enabled, an active dynamic membership is authoritative for that user's scheduling experience. A user may temporarily retain a legacy role/membership in the database for rollback/history, but the UI must prefer the dynamic experience. Legacy records are not deleted by cutover.

Cutover is deliberately not activated by this audit phase. It will be activated only after the requested end-to-end QA. This prevents a partially built dynamic feature from hiding a working legacy workflow during the pilot.

## Audit result (2026-09-09)
The employee-facing dynamic runtime is already clean of the three GVK role identities:
- `MyDynamicAvailabilityPage`
- `MyDynamicShiftsPage`
- `MyDynamicShiftExchangesPage`
- `dynamicSchedulingService` operational methods

The remaining legacy-specific code is concentrated in legacy services/pages, historical migrations, import/export/statistics compatibility, and the role-membership migration bridge. These are migration/compatibility surfaces, not the target generic runtime.

### Transitional items that must be removed or isolated before final product cutover
1. `DynamicJobTypesPanel` still exposes `legacyRole` information and locks the internal code for legacy-linked job types. This is acceptable only as a GVK migration bridge.
2. Legacy navigation routes still exist for rollback/pilot compatibility. Final cutover must make dynamic membership authoritative and then remove the legacy navigation entries.
3. Statistics, archive/export and several dashboard paths are still legacy-specific. They must be replaced by `job_type_id` based implementations before the product can be called fully generic.
4. The legacy import adapter may continue to understand `dispatcher`, `on_call`, and `morning_driver`; no new runtime feature may depend on those values.
5. Historical SQL migrations are immutable history and are not rewritten merely to remove old names.

## Guardrail
Run `npm run audit:dynamic-runtime`. It checks the employee-facing dynamic runtime files and fails if a GVK legacy role token is introduced there.

## Final cutover acceptance rule
Do not delete legacy data first. The order is:
1. Complete generic feature parity and end-to-end QA.
2. Enable Dynamic-first navigation/runtime for users with active dynamic memberships.
3. Validate GVK pilot users and managers.
4. Keep legacy data read-only for rollback/history during the agreed safety window.
5. Remove legacy role assignments/routes only after validation.
