# Stage 2 — monthly mapping snapshots (foundation only)

This migration adds an immutable month-specific snapshot of the centrally saved Excel mapping. It does **not** yet connect the automatic archive to the manual Excel generator. Do not deploy as a complete archive unification solution or retry the October archive based on this migration alone.

## Apply
1. Confirm the stage-1 migration `20261101150000_schedule_excel_export_layout.sql` was applied.
2. Apply `20261101170000_schedule_excel_export_layout_monthly_snapshot.sql` once using the Supabase migration workflow.
3. Verify that `public.schedule_excel_export_layout_monthly_snapshots` exists.

## Caveats
- Snapshot creation requires the service-role JWT; a regular user cannot invoke it.
- The first snapshot captures the **current** central mapping, not a historically proven mapping for an earlier month. Therefore, **do not capture October 2026 automatically** without validating the mapping against October's published job types.
- The archive Edge Function and browser exporter still use separate Excel rendering implementations. Their outputs must be compared before any automated delivery.
- This migration does not modify existing schedules, send emails, or change cron.
