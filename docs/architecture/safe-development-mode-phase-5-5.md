# Phase 5.5 — Safe Development Mode

Safe Development Mode is a per-system-admin simulation safety layer for live production development.

## Guarantees
- It is personal to the authenticated `admin`; other users continue normally.
- It expires automatically (30m/1h/4h/12h from UI).
- A persistent banner makes the mode visible.
- A database trigger safety net blocks INSERT/UPDATE/DELETE on existing public production tables for that authenticated admin.
- Notification records and schedule/user/availability/permission writes are therefore blocked at the database boundary when their backing tables are present.
- Dynamic shadow/configuration tables remain writable so Phase 1–5 simulation work can continue.

## Important behavior
This phase favors safety over pretending a write succeeded. A production write attempted in development mode returns `SIMULATION_MODE` and no production mutation is committed. Existing screens may therefore show their normal error surface with the simulation-mode message. Rich per-action "what would have happened" previews can be added incrementally later.

## Scope
The migration installs guards on public tables that exist when the migration runs. New future production tables must either receive the same guard or be deliberately classified as shadow/configuration.
