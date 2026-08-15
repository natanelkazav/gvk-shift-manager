import {
  createBrowserRouter,
} from 'react-router-dom';
import ShiftsPage
  from '../pages/ShiftsPage';
import PermissionRoute
  from '../auth/PermissionRoute';

import ProtectedRoute
  from '../auth/ProtectedRoute';

import PublicOnlyRoute
  from '../auth/PublicOnlyRoute';
  import MorningDriverSchedulePage
  from '../pages/MorningDriverSchedulePage';
import AppLayout
  from '../layouts/AppLayout';

import ArchivePage
  from '../pages/ArchivePage';

import AuditLogPage
  from '../pages/AuditLogPage';

import AvailabilityPage
  from '../pages/AvailabilityPage';

import ChangePasswordPage
  from '../pages/ChangePasswordPage';

import DashboardPage
  from '../pages/DashboardPage';

import DriverSchedulePage
  from '../pages/DriverSchedulePage';

import LoginPage
  from '../pages/LoginPage';

import MorningDriverAvailabilityPage
  from '../pages/MorningDriverAvailabilityPage';

import NotFoundPage
  from '../pages/NotFoundPage';

import NotificationsPage
  from '../pages/NotificationsPage';

import SchedulePage
  from '../pages/SchedulePage';

import SettingsPage
  from '../pages/SettingsPage';

import ShiftSwapsPage
  from '../pages/ShiftSwapsPage';

import StatisticsPage
  from '../pages/StatisticsPage';

import UsersPage
  from '../pages/UsersPage';

export const router =
  createBrowserRouter([
    {
      element:
        <PublicOnlyRoute />,

      children: [
        {
          path:
            '/login',

          element:
            <LoginPage />,
        },
      ],
    },

    {
      element:
        <ProtectedRoute />,

      children: [
        {
          path:
            '/change-password',

          element: (
            <ChangePasswordPage />
          ),
        },

        {
          path:
            '/',

          element:
            <AppLayout />,

          children: [
            {
              index:
                true,

              element:
                <DashboardPage />,
            },

            {
              element: (
                <PermissionRoute
                  permission="audit.view"
                />
              ),

              children: [
                {
                  path:
                    'audit',

                  element:
                    <AuditLogPage />,
                },
              ],
            },
            {
              element: (
                <PermissionRoute
                  anyPermissions={[
                    'morning_driver_schedule.view',
                    'morning_driver_schedule.view_team',
                    'morning_driver_schedule.edit',
                  ]}
                />
              ),

              children: [
                {
                  path:
                    'morning-driver-schedule',

                  element: (
                    <MorningDriverSchedulePage />
                  ),
                },
              ],
            },
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

              children: [
                {
                  path:
                    'availability',

                  element: (
                    <AvailabilityPage />
                  ),
                },
              ],
            },

            {
              element: (
                <PermissionRoute
                  permission="schedule.view"
                />
              ),

              children: [
                {
                  path:
                    'schedule',

                  element: (
                    <SchedulePage />
                  ),
                },
              ],
            },

            {
              element: (
                <PermissionRoute
                  anyPermissions={[
                    'driver_availability.view',
                    'driver_availability.manage',
                    'driver_schedule.view',
                    'driver_schedule.view_team',
                    'driver_schedule.edit',
                  ]}
                />
              ),

              children: [
                {
                  path:
                    'driver-schedule',

                  element: (
                    <DriverSchedulePage />
                  ),
                },
              ],
            },

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
                  path:
                    'morning-driver-availability',

                  element: (
                    <MorningDriverAvailabilityPage />
                  ),
                },
              ],
            },

            {
              element: (
                <PermissionRoute
                  anyPermissions={[
                    'users.view',
                    'users.manage',
                  ]}
                />
              ),

              children: [
                {
                  path:
                    'users',

                  element:
                    <UsersPage />,
                },
              ],
            },

            {
              element: (
                <PermissionRoute
                  anyPermissions={[
                    'settings.view',
                    'settings.manage',
                  ]}
                />
              ),

              children: [
                {
                  path:
                    'settings',

                  element: (
                    <SettingsPage />
                  ),
                },
              ],
            },
          {
            element: (
              <PermissionRoute
                anyPermissions={[
                  'schedule.view',
                  'schedule.edit',
                  'availability.manage',
                  'driver_schedule.view_team',
                  'driver_schedule.edit',
                  'driver_availability.manage',
                  'morning_driver_schedule.view_team',
                  'morning_driver_schedule.edit',
                  'morning_driver_availability.manage',
                ]}
              />
            ),

            children: [
              {
                path:
                  'shifts',

                element: (
                  <ShiftsPage />
                ),
              },
            ],
          },
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

              children: [
                {
                  path:
                    'notifications',

                  element: (
                    <NotificationsPage />
                  ),
                },
              ],
            },

            {
              element: (
                <PermissionRoute
                  permission="statistics.view"
                />
              ),

              children: [
                {
                  path:
                    'statistics',

                  element: (
                    <StatisticsPage />
                  ),
                },
              ],
            },

            {
              element: (
                  <PermissionRoute
                    anyPermissions={[
                      'shift_swaps.view',
                      'shift_swaps.approve',
                    ]}
                  />
              ),

              children: [
                {
                  path:
                    'shift-swaps',

                  element: (
                    <ShiftSwapsPage />
                  ),
                },
              ],
            },

            {
              element: (
                <PermissionRoute
                  permission="archive.view"
                />
              ),

              children: [
                {
                  path:
                    'archive',

                  element: (
                    <ArchivePage />
                  ),
                },
              ],
            },

            {
              path:
                '*',

              element:
                <NotFoundPage />,
            },
          ],
        },
      ],
    },
  ]);