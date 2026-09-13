Phase 10.5.8 — Management unified schedule calendar

Adds a third tab under שיבוצים: לוח שנה.

What it does:
- Read-only month calendar for system admins / Job Type managers.
- Current month and previous months only.
- Combines live Dynamic publications with imported Dynamic historical schedules.
- Filters by one or more Dynamic Job Types.
- Filters: all / assigned / unassigned.
- Every shift/on-call card shows the assigned employee name(s).
- Unassigned / partially-unassigned positions are highlighted.
- Holiday labels and 200% badge remain visible when data exists.
- Legacy Job Type adapters stay hidden.

Files:
- src/pages/ShiftsPage.tsx
- src/components/shifts/DynamicAllSchedulesCalendar.tsx
- src/services/dynamicSchedulingService.ts
- src/types/dynamicShiftsWorkspace.ts
- src/styles/dynamicShiftsWorkspace.css
- src/help/helpWhatsNew.ts
- supabase/migrations/20260913140000_phase10_5_8_management_schedule_calendar.sql

After copying:
1. npx supabase db push
2. npm run typecheck
3. npm run test:contracts
4. npm run audit:dynamic-runtime
5. npm run build
