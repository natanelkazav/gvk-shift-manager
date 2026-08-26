GVK Shift Manager - Morning Driver Scheduling Patch
2026-08-26

Includes only files changed for the latest morning-driver scheduling update:
- Intentional unassigned morning-driver shifts.
- Coverage-first draft generation (minimum coverage before second driver).
- Publish when every shift is assigned or explicitly intentionally unassigned.
- UI/workflow/types/service updates.
- Help Center update.
- DB migration and schema regression test update.

After copying:
  npm run test:quality
  npx supabase db push
  npm run test:smoke
  npm run build

No Edge Function deployment required.
