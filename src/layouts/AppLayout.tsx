import {
  Archive,
  BarChart3,
  Bell,
  CalendarDays,
  Car,
  LayoutDashboard,
  LogOut,
  Menu,
  Repeat2,
  ScrollText,
  ClipboardList,
  Settings,
  Users,
  X,
} from 'lucide-react';
import {
  useMemo,
  useState,
} from 'react';
import {
  NavLink,
  Outlet,
} from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type {
  PermissionKey,
} from '../types/auth';
import '../styles/layout.css';

interface NavigationItem {
  label: string;
  path: string;
  end?: boolean;
  icon: typeof LayoutDashboard;
  permission: PermissionKey;
}

const navigationItems: NavigationItem[] = [
  {
    label: 'לוח בקרה',
    path: '/',
    end: true,
    icon: LayoutDashboard,
    permission: 'dashboard.view',
  },
  {
    label: 'שיבוץ מוקדנים',
    path: '/schedule',
    icon: CalendarDays,
    permission: 'schedule.view',
  },
  {
    label: 'אילוצי מוקדנים',
    path: '/availability',
    icon: ClipboardList,
    permission: 'availability.view',
  },
  {
    label: 'לוח כוננים',
    path: '/driver-schedule',
    icon: Car,
    permission:
      'driver_schedule.view',
  },
  {
    label: 'ניהול משתמשים',
    path: '/users',
    icon: Users,
    permission: 'users.view',
  },
  {
  label: 'יומן מערכת',
  path: '/audit',
  icon: ScrollText,
  permission: 'audit.view',
},
  {
    label: 'התראות',
    path: '/notifications',
    icon: Bell,
    permission:
      'notifications.view',
  },
  {
    label: 'סטטיסטיקות',
    path: '/statistics',
    icon: BarChart3,
    permission:
      'statistics.view',
  },
  {
    label: 'החלפות משמרת',
    path: '/shift-swaps',
    icon: Repeat2,
    permission:
      'shift_swaps.view',
  },
  {
    label: 'ארכיון',
    path: '/archive',
    icon: Archive,
    permission: 'archive.view',
  },
  {
    label: 'הגדרות',
    path: '/settings',
    icon: Settings,
    permission: 'settings.view',
  },
];

const roleLabels = {
  admin: 'מנהל מערכת',
  manager: 'מנהל מוקד',
  dispatcher: 'מוקדן',
  on_call: 'כונן',
  viewer: 'צפייה בלבד',
} as const;

function getInitial(
  displayName: string,
): string {
  const normalizedName =
    displayName.trim();

  if (!normalizedName) {
    return '?';
  }

  return normalizedName.charAt(0);
}

function AppLayout() {
  const {
    profile,
    hasPermission,
    signOut,
  } = useAuth();

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] = useState(false);

  const [
    isSigningOut,
    setIsSigningOut,
  ] = useState(false);

  const visibleNavigationItems =
    useMemo(() => {
      return navigationItems.filter(
        (item) =>
          hasPermission(
            item.permission,
          ),
      );
    }, [hasPermission]);

  const closeSidebar = (): void => {
    setIsSidebarOpen(false);
  };

  const toggleSidebar = (): void => {
    setIsSidebarOpen(
      (currentValue) =>
        !currentValue,
    );
  };

  const handleSignOut =
    async (): Promise<void> => {
      setIsSigningOut(true);

      try {
        await signOut();
      } finally {
        setIsSigningOut(false);
      }
    };

  const displayName =
    profile?.displayName ??
    'משתמש';

  const roleLabel = profile
    ? roleLabels[profile.role]
    : '';

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
        className={[
          'app-sidebar',
          isSidebarOpen
            ? 'app-sidebar-open'
            : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="app-sidebar-header">
          <div className="app-logo">
            <strong>
              GVK Shift Manager
            </strong>

            <span>
              מערכת ניהול ושיבוץ
              משמרות
            </span>
          </div>

          <button
            type="button"
            className="sidebar-close-button"
            aria-label="סגירת התפריט"
            onClick={closeSidebar}
          >
            <X
              size={22}
              aria-hidden="true"
            />
          </button>
        </div>

        <nav
          className="app-navigation"
          aria-label="ניווט ראשי"
        >
          {visibleNavigationItems.map(
            (item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({
                    isActive,
                  }) =>
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

                  <span>
                    {item.label}
                  </span>
                </NavLink>
              );
            },
          )}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-sign-out-button"
            disabled={isSigningOut}
            onClick={() => {
              void handleSignOut();
            }}
          >
            <LogOut
              size={20}
              aria-hidden="true"
            />

            <span>
              {isSigningOut
                ? 'מתנתק...'
                : 'התנתקות'}
            </span>
          </button>
        </div>
      </aside>

      <div className="app-content-wrapper">
        <header className="app-header">
          <div className="app-header-start">
            <button
              type="button"
              className="sidebar-menu-button"
              aria-label="פתיחת תפריט הניווט"
              aria-expanded={
                isSidebarOpen
              }
              onClick={toggleSidebar}
            >
              <Menu
                size={24}
                aria-hidden="true"
              />
            </button>

            <span className="app-header-brand">
              מערכת ניהול משמרות
            </span>
          </div>

          <div className="app-user">
            <div
              className="app-user-avatar"
              aria-hidden="true"
            >
              {getInitial(
                displayName,
              )}
            </div>

            <div className="app-user-details">
              <span className="app-user-name">
                {displayName}
              </span>

              <span className="app-user-role">
                {roleLabel}
              </span>
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