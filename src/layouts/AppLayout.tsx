import {
  Archive,
  BarChart3,
  Bell,
  CalendarDays,
  Car,
  LayoutDashboard,
  Menu,
  Repeat2,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import '../styles/layout.css';

interface NavigationItem {
  label: string;
  path: string;
  end?: boolean;
  icon: typeof LayoutDashboard;
}

const navigationItems: NavigationItem[] = [
  {
    label: 'לוח בקרה',
    path: '/',
    end: true,
    icon: LayoutDashboard,
  },
  {
    label: 'שיבוץ מוקדנים',
    path: '/schedule',
    icon: CalendarDays,
  },
  {
    label: 'לוח כוננים',
    path: '/driver-schedule',
    icon: Car,
  },
  {
    label: 'ניהול משתמשים',
    path: '/users',
    icon: Users,
  },
  {
    label: 'התראות',
    path: '/notifications',
    icon: Bell,
  },
  {
    label: 'סטטיסטיקות',
    path: '/statistics',
    icon: BarChart3,
  },
  {
    label: 'החלפות משמרת',
    path: '/shift-swaps',
    icon: Repeat2,
  },
  {
    label: 'ארכיון',
    path: '/archive',
    icon: Archive,
  },
  {
    label: 'הגדרות',
    path: '/settings',
    icon: Settings,
  },
];

function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((currentValue) => !currentValue);
  };

  return (
    <div className="app-layout">
      {isSidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="סגירת תפריט הניווט"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={`app-sidebar ${isSidebarOpen ? 'app-sidebar-open' : ''}`}
      >
        <div className="app-sidebar-header">
          <div className="app-logo">
            <strong>GVK Shift Manager</strong>
            <span>מערכת ניהול ושיבוץ משמרות</span>
          </div>

          <button
            type="button"
            className="sidebar-close-button"
            aria-label="סגירת התפריט"
            onClick={closeSidebar}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <nav className="app-navigation" aria-label="ניווט ראשי">
          {navigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  isActive
                    ? 'navigation-link navigation-link-active'
                    : 'navigation-link'
                }
                onClick={closeSidebar}
              >
                <Icon
                  className="navigation-link-icon"
                  size={20}
                  strokeWidth={2}
                  aria-hidden="true"
                />

                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="app-content-wrapper">
        <header className="app-header">
          <div className="app-header-start">
            <button
              type="button"
              className="sidebar-menu-button"
              aria-label="פתיחת תפריט הניווט"
              aria-expanded={isSidebarOpen}
              onClick={toggleSidebar}
            >
              <Menu size={24} aria-hidden="true" />
            </button>

            <span className="app-header-brand">מערכת ניהול משמרות</span>
          </div>

          <div className="app-user">
            <div className="app-user-avatar" aria-hidden="true">
              נ
            </div>

            <div className="app-user-details">
              <span className="app-user-name">נתנאל</span>
              <span className="app-user-role">מנהל מערכת</span>
            </div>
          </div>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;