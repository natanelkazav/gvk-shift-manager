import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import ArchivePage from '../pages/ArchivePage';
import DashboardPage from '../pages/DashboardPage';
import DriverSchedulePage from '../pages/DriverSchedulePage';
import NotFoundPage from '../pages/NotFoundPage';
import NotificationsPage from '../pages/NotificationsPage';
import SchedulePage from '../pages/SchedulePage';
import SettingsPage from '../pages/SettingsPage';
import ShiftSwapsPage from '../pages/ShiftSwapsPage';
import StatisticsPage from '../pages/StatisticsPage';
import UsersPage from '../pages/UsersPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'schedule',
        element: <SchedulePage />,
      },
      {
        path: 'driver-schedule',
        element: <DriverSchedulePage />,
      },
      {
        path: 'users',
        element: <UsersPage />,
      },
      {
        path: 'notifications',
        element: <NotificationsPage />,
      },
      {
        path: 'statistics',
        element: <StatisticsPage />,
      },
      {
        path: 'shift-swaps',
        element: <ShiftSwapsPage />,
      },
      {
        path: 'archive',
        element: <ArchivePage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);