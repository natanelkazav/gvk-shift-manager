GVK Shift Manager - Phase 10.6.1
Client version tracking + update notifications

What this patch adds:
- Reports the actual frontend version/build used by each signed-in browser/PWA installation.
- Admin panel in Users -> Users: current/outdated/mixed/unknown version status.
- Shows last reported version, build id, device count, last seen time, and dynamic Job Types.
- Sends a system + Push update request to outdated users, all active users, or a selected dynamic Job Type.
- Version is 2.0.0-rc.7. On Vercel the build id uses VERCEL_GIT_COMMIT_SHA automatically.
- Help / What's New updated.

After copying:
1. npx supabase db push
2. npm run typecheck
3. npm run test:contracts
4. npm run audit:dynamic-runtime
5. npm run build

Migration:
20260914150000_phase10_6_1_client_version_tracking.sql

Notes:
- Version data starts filling only after users open the app with this patch deployed.
- A user can have more than one browser/PWA installation, so the overview tracks devices separately.
- Sending update notifications requires notifications.manage.
