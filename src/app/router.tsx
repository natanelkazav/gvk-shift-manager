import {
  createBrowserRouter,
} from 'react-router-dom';
import PermissionRoute from '../auth/PermissionRoute';
import ProtectedRoute from '../auth/ProtectedRoute';
import PublicOnlyRoute from '../auth/PublicOnlyRoute';
import AppLayout from '../layouts/AppLayout';
import ArchivePage from '../pages/ArchivePage';
import ChangePasswordPage from '../pages/ChangePasswordPage';
import DashboardPage from '../pages/DashboardPage';
import DriverSchedulePage from '../pages/DriverSchedulePage';
import LoginPage from '../pages/LoginPage';
import NotFoundPage from '../pages/NotFoundPage';
import NotificationsPage from '../pages/NotificationsPage';
import SchedulePage from '../pages/SchedulePage';
import SettingsPage from '../pages/SettingsPage';
import ShiftSwapsPage from '../pages/ShiftSwapsPage';
import StatisticsPage from '../pages/StatisticsPage';
import UsersPage from '../pages/UsersPage';
import AuditLogPage from '../pages/AuditLogPage';

export const router =
  createBrowserRouter([
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
          element: (
            <ChangePasswordPage />
          ),
        },
        {
          path: '/',
          element: <AppLayout />,
          children: [
            {
              index: true,
              element: <DashboardPage />,
            },
            {
            element: (
              <PermissionRoute
                permission="audit.view"
              />
            ),
            children: [
              {
                path: 'audit',
                element: <AuditLogPage />,
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
                  path: 'schedule',
                  element: (
                    <SchedulePage />
                  ),
                },
              ],
            },

            {
              element: (
                <PermissionRoute
                  permission="driver_schedule.view"
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
                  permission="users.view"
                />
              ),
              children: [
                {
                  path: 'users',
                  element: <UsersPage />,
                },
              ],
            },

            {
              element: (
                <PermissionRoute
                  permission="settings.view"
                />
              ),
              children: [
                {
                  path: 'settings',
                  element: (
                    <SettingsPage />
                  ),
                },
              ],
            },

            {
              element: (
                <PermissionRoute
                  permission="notifications.view"
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
                  path: 'statistics',
                  element: (
                    <StatisticsPage />
                  ),
                },
              ],
            },

            {
              element: (
                <PermissionRoute
                  permission="shift_swaps.view"
                />
              ),
              children: [
                {
                  path: 'shift-swaps',
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
                  path: 'archive',
                  element: (
                    <ArchivePage />
                  ),
                },
              ],
            },

            {
              path: '*',
              element: <NotFoundPage />,
            },
          ],
        },
      ],
    },
  ]);