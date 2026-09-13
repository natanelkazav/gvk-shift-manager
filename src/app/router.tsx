import { createBrowserRouter } from 'react-router-dom';

import ProtectedRoute from '../auth/ProtectedRoute';
import PublicOnlyRoute from '../auth/PublicOnlyRoute';
import PermissionRoute from '../auth/PermissionRoute';
import LegacyRuntimeRoute from '../auth/LegacyRuntimeRoute';
import AppLayout from '../layouts/AppLayout';

import ArchivePage from '../pages/ArchivePage';
import AuditLogPage from '../pages/AuditLogPage';
import AvailabilityPage from '../pages/AvailabilityPage';
import ChangePasswordPage from '../pages/ChangePasswordPage';
import DashboardPage from '../pages/DashboardPage';
import DriverSchedulePage from '../pages/DriverSchedulePage';
import LoginPage from '../pages/LoginPage';
import MorningDriverAvailabilityPage from '../pages/MorningDriverAvailabilityPage';
import MorningDriverSchedulePage from '../pages/MorningDriverSchedulePage';
import MyDynamicAvailabilityPage from '../pages/MyDynamicAvailabilityPage';
import MyDynamicShiftExchangesPage from '../pages/MyDynamicShiftExchangesPage';
import MyDynamicShiftsPage from '../pages/MyDynamicShiftsPage';
import NotFoundPage from '../pages/NotFoundPage';
import NotificationsPage from '../pages/NotificationsPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import SchedulePage from '../pages/SchedulePage';
import SettingsPage from '../pages/SettingsPage';
import ShiftSwapsPage from '../pages/ShiftSwapsPage';
import ShiftsPage from '../pages/ShiftsPage';
import StatisticsPage from '../pages/StatisticsPage';
import UsersPage from '../pages/UsersPage';

export const router = createBrowserRouter([
  {
    path: '/reset-password',
    element: <ResetPasswordPage />,
  },
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/change-password',
        element: <ChangePasswordPage />,
      },
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },

          {
            element: <PermissionRoute permission="audit.view" />,
            children: [{ path: 'audit', element: <AuditLogPage /> }],
          },

          {
            element: <PermissionRoute anyPermissions={['users.view', 'users.manage']} />,
            children: [{ path: 'users', element: <UsersPage /> }],
          },

          // Dynamic-first employee and manager workspaces.
          { path: 'my-availability', element: <MyDynamicAvailabilityPage /> },
          { path: 'my-shifts', element: <MyDynamicShiftsPage /> },
          { path: 'my-shift-exchanges', element: <MyDynamicShiftExchangesPage /> },
          { path: 'shifts', element: <ShiftsPage /> },

          { path: 'settings', element: <SettingsPage /> },

          {
            element: (
              <PermissionRoute
                anyPermissions={[
                  'notifications.view',
                  'notifications.manage',
                  'shift_swaps.approve',
                ]}
              />
            ),
            children: [{ path: 'notifications', element: <NotificationsPage /> }],
          },

          {
            element: <PermissionRoute permission="statistics.view" />,
            children: [{ path: 'statistics', element: <StatisticsPage /> }],
          },

          {
            element: <PermissionRoute permission="archive.view" />,
            children: [{ path: 'archive', element: <ArchivePage /> }],
          },

          // -----------------------------------------------------------------
          // Legacy compatibility URLs
          // -----------------------------------------------------------------
          // Old bookmarks/notifications remain valid while a user is still on
          // Legacy-first. Dynamic-first users are redirected to the equivalent
          // generic workspace so the two systems are never mixed in one UX.
          {
            element: <LegacyRuntimeRoute redirectTo="/my-availability" />,
            children: [
              {
                element: (
                  <PermissionRoute
                    anyPermissions={[
                      'availability.view',
                      'availability.manage',
                      'schedule.edit',
                    ]}
                  />
                ),
                children: [{ path: 'availability', element: <AvailabilityPage /> }],
              },
            ],
          },
          {
            element: <LegacyRuntimeRoute redirectTo="/my-shifts" />,
            children: [
              {
                element: (
                  <PermissionRoute
                    anyPermissions={[
                      'schedule.view',
                      'schedule.view_team',
                      'schedule.edit',
                    ]}
                  />
                ),
                children: [{ path: 'schedule', element: <SchedulePage /> }],
              },
            ],
          },
          {
            element: <LegacyRuntimeRoute redirectTo="/my-shifts" />,
            children: [
              {
                element: (
                  <PermissionRoute
                    anyPermissions={[
                      'driver_availability.view',
                      'driver_availability.manage',
                      'driver_schedule.view',
                      'driver_schedule.view_team',
                      'driver_schedule.edit',
                      'driver_schedule.edit_any',
                    ]}
                  />
                ),
                children: [{ path: 'driver-schedule', element: <DriverSchedulePage /> }],
              },
            ],
          },
          {
            element: <LegacyRuntimeRoute redirectTo="/my-availability" />,
            children: [
              {
                element: (
                  <PermissionRoute
                    anyPermissions={[
                      'morning_driver_availability.view',
                      'morning_driver_availability.manage',
                    ]}
                  />
                ),
                children: [
                  {
                    path: 'morning-driver-availability',
                    element: <MorningDriverAvailabilityPage />,
                  },
                ],
              },
            ],
          },
          {
            element: <LegacyRuntimeRoute redirectTo="/my-shifts" />,
            children: [
              {
                element: (
                  <PermissionRoute
                    anyPermissions={[
                      'morning_driver_schedule.view',
                      'morning_driver_schedule.view_team',
                      'morning_driver_schedule.edit',
                      'morning_driver_schedule.edit_any',
                    ]}
                  />
                ),
                children: [
                  {
                    path: 'morning-driver-schedule',
                    element: <MorningDriverSchedulePage />,
                  },
                ],
              },
            ],
          },
          {
            element: <LegacyRuntimeRoute redirectTo="/my-shift-exchanges" />,
            children: [
              {
                element: <PermissionRoute permission="shift_swaps.view" />,
                children: [{ path: 'shift-swaps', element: <ShiftSwapsPage /> }],
              },
            ],
          },

          // Explicit recovery area. These routes intentionally bypass the
          // Dynamic-first redirect and are not advertised in the main menu.
          // Access is limited to users who can manage users/system setup.
          {
            element: <PermissionRoute permission="users.manage" />,
            children: [
              { path: 'legacy/availability', element: <AvailabilityPage /> },
              { path: 'legacy/schedule', element: <SchedulePage /> },
              { path: 'legacy/driver-schedule', element: <DriverSchedulePage /> },
              {
                path: 'legacy/morning-driver-availability',
                element: <MorningDriverAvailabilityPage />,
              },
              {
                path: 'legacy/morning-driver-schedule',
                element: <MorningDriverSchedulePage />,
              },
              { path: 'legacy/shift-swaps', element: <ShiftSwapsPage /> },
            ],
          },

          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
