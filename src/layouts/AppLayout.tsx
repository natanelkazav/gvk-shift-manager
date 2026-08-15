import {
  Archive,
  BarChart3,
  Bell,
  CalendarDays,
  Car,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Repeat2,
  ScrollText,
  Settings,
  SunMedium,
  Users,
  X,
} from 'lucide-react';

import PushPermissionPrompt
  from '../features/push/components/PushPermissionPrompt';

import NotificationClickHandler
  from '../features/notifications/components/NotificationClickHandler';

import {
  useMemo,
  useState,
} from 'react';

import NotificationBell
  from '../features/notifications/components/NotificationBell';

  import {
  PushStatusProvider,
} from '../features/push/context/PushStatusProvider';

import {
  NavLink,
  Outlet,
} from 'react-router-dom';

import {
  NotificationProvider,
} from '../features/notifications/context/NotificationProvider';

import {
  useAuth,
} from '../auth/AuthContext';

import type {
  PermissionKey,
  UserRole,
} from '../types/auth';

import '../styles/layout.css';

interface NavigationItem {
  label: string;

  path: string;

  end?: boolean;

  icon: typeof LayoutDashboard;

  requiredPermissions:
    readonly PermissionKey[];

  visibleForRoles?:
    readonly UserRole[];

  hiddenForRoles?:
    readonly UserRole[];
}

const navigationItems:
  NavigationItem[] = [
    {
      label:
        'לוח בקרה',

      path:
        '/',

      end:
        true,

      icon:
        LayoutDashboard,

      requiredPermissions: [
        'dashboard.view'],
    },
    {
      label:
        'משמרות',

      path:
        '/shifts',

      icon:
        CalendarDays,

      requiredPermissions: [
        'schedule.edit',
        'availability.manage',
        'driver_schedule.view_team',
        'driver_schedule.edit',
        'driver_availability.manage',
        'morning_driver_schedule.view_team',
        'morning_driver_schedule.edit',
        'morning_driver_availability.manage',
      ],

      visibleForRoles: [
        'admin',
        'manager',
      ],
    },
    {
      label:
        'שיבוץ מוקדנים',

      path:
        '/schedule',

      icon:
        CalendarDays,

      requiredPermissions: [
        'schedule.view'],

      hiddenForRoles: [
      'admin',
      'manager',
      ],
    },

{
  label: 'אילוצי מוקדנים',
  path: '/availability',
  icon: ClipboardList,

  requiredPermissions: [
    'availability.view',
    'availability.manage',
  ],
    hiddenForRoles: [
    'admin',
    'manager',
  ],
},

    {
      label:
        'לוח כוננים',

      path:
        '/driver-schedule',

      icon:
        Car,

  requiredPermissions: [
    'driver_schedule.view',
    'driver_schedule.view_team',
    'driver_schedule.edit',
  ],
          hiddenForRoles: [
        'admin',
        'manager',
        ],
    },

{
  label: 'כונני בוקר',
  path: '/morning-driver-availability',
  icon: SunMedium,

  requiredPermissions: [
    'morning_driver_availability.view',
    'morning_driver_availability.manage',
  ],
    hiddenForRoles: [
    'admin',
    'manager',
  ],
},
    {
      label: 'לוח כונני בוקר',
      path: '/morning-driver-schedule',
      icon: CalendarDays,

      requiredPermissions: [
        'morning_driver_schedule.view',
        'morning_driver_schedule.view_team',
        'morning_driver_schedule.edit',
      ],
            hiddenForRoles: [
        'admin',
        'manager',
        ],
    },
    {
      label:
        'ניהול משתמשים',

      path:
        '/users',

      icon:
        Users,

requiredPermissions: [
  'users.view',
  'users.manage',
],
    },

    {
      label:
        'יומן מערכת',

      path:
        '/audit',

      icon:
        ScrollText,

      requiredPermissions: [
        'audit.view'],
    },

    {
      label:
        'התראות',

      path:
        '/notifications',

      icon:
        Bell,

      requiredPermissions: [
        'notifications.view',
        'notifications.manage',
      ],
    },

    {
      label:
        'סטטיסטיקות',

      path:
        '/statistics',

      icon:
        BarChart3,

      requiredPermissions: [
        'statistics.view'],
    },

    {
      label:
        'החלפות משמרת',

      path:
        '/shift-swaps',

      icon:
        Repeat2,

requiredPermissions: [
  'shift_swaps.view',
  'shift_swaps.approve',
],
    },

    {
      label:
        'ארכיון',

      path:
        '/archive',

      icon:
        Archive,

      requiredPermissions: [
        'archive.view'],
    },

    {
      label:
        'הגדרות',

      path:
        '/settings',

      icon:
        Settings,

      requiredPermissions: [
        'settings.view',
        'settings.manage',
      ],
    },
  ];

function getNavigationLabel(
  item:
    NavigationItem,

  role:
    UserRole |
    undefined,

  canApproveShiftSwaps:
    boolean,
): string {
  if (
    item.path ===
      '/notifications'
  ) {
    return canApproveShiftSwaps
      ? 'התראות ובקשות'
      : 'התראות';
  }

  if (
    role ===
    'dispatcher'
  ) {
    if (
      item.path ===
      '/schedule'
    ) {
      return 'השיבוצים שלי';
    }

    if (
      item.path ===
      '/availability'
    ) {
      return 'האילוצים שלי';
    }
  }

  if (
    role ===
      'on_call' &&
    item.path ===
      '/driver-schedule'
  ) {
    return 'לוח הכוננים שלי';
  }

    if (
      role === 'morning_driver' &&
      item.path === '/morning-driver-schedule'
    ) {
      return 'השיבוצים שלי';
    }

  return item.label;
}

const roleLabels:
  Record<
    UserRole,
    string
  > = {
    admin:
      'מנהל מערכת',

    manager:
      'מנהל מוקד',

    dispatcher:
      'מוקדן',

    on_call:
      'כונן',

    morning_driver:
      'כונן בוקר',

    viewer:
      'צפייה בלבד',
  };

function getInitial(
  displayName:
    string,
): string {
  const normalizedName =
    displayName.trim();

  if (
    !normalizedName
  ) {
    return '?';
  }

  return normalizedName
    .charAt(
      0,
    );
}

function AppLayout() {
  const {
    profile,
    hasPermission,
    signOut,
  } =
    useAuth();

  const [
    isSidebarOpen,
    setIsSidebarOpen,
  ] =
    useState(
      false,
    );

  const [
    isSigningOut,
    setIsSigningOut,
  ] =
    useState(
      false,
    );

const visibleNavigationItems =
  useMemo(
    () => {
      const currentRole =
        profile?.role;

      return navigationItems.filter(
        (item) => {
          const hasRequiredPermission =
            item.requiredPermissions.some(
              (permission) =>
                hasPermission(
                  permission,
                ),
            );

          if (
            !hasRequiredPermission
          ) {
            return false;
          }

          if (
            item.visibleForRoles &&
            (
              !currentRole ||
              !item.visibleForRoles.includes(
                currentRole,
              )
            )
          ) {
            return false;
          }

          if (
            currentRole &&
            item.hiddenForRoles?.includes(
              currentRole,
            )
          ) {
            return false;
          }

          return true;
        },
      );
    },
    [
      hasPermission,
      profile?.role,
    ],
  );

  const closeSidebar =
    (): void => {
      setIsSidebarOpen(
        false,
      );
    };

  const toggleSidebar =
    (): void => {
      setIsSidebarOpen(
        (
          currentValue,
        ) =>
          !currentValue,
      );
    };

const handleSignOut =
  async (): Promise<void> => {
    setIsSigningOut(
      true,
    );

    try {
      sessionStorage.removeItem(
        'push-permission-dismissed',
      );

      await signOut();
    } finally {
      setIsSigningOut(
        false,
      );
    }
  };

  const displayName =
    profile?.displayName ??
    'משתמש';

  const roleLabel =
    profile
      ? roleLabels[
          profile.role
        ]
      : '';

return (
<PushStatusProvider>
  <NotificationProvider>
    <NotificationClickHandler />
    <div className="app-layout">
      {isSidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="סגירת תפריט הניווט"
          onClick={
            closeSidebar
          }
        />
      ) : null}

      <aside
        className={[
          'app-sidebar',

          isSidebarOpen
            ? 'app-sidebar-open'
            : '',
        ]
          .filter(
            Boolean,
          )
          .join(
            ' ',
          )}
      >
        <div className="app-sidebar-header">
          <div className="app-logo">
            <strong>
              GVK Shift Manager
            </strong>

            <span>
              מערכת ניהול ושיבוץ משמרות
            </span>
          </div>

          <button
            type="button"
            className="sidebar-close-button"
            aria-label="סגירת התפריט"
            onClick={
              closeSidebar
            }
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
          {visibleNavigationItems
            .map(
              (
                item,
              ) => {
                const Icon =
                  item.icon;

                return (
                  <NavLink
                    key={
                      item.path
                    }
                    to={
                      item.path
                    }
                    end={
                      item.end
                    }
                    className={({
                      isActive,
                    }) =>
                      isActive
                        ? 'navigation-link navigation-link-active'
                        : 'navigation-link'
                    }
                    onClick={
                      closeSidebar
                    }
                  >
                    <Icon
                      className="navigation-link-icon"
                      size={20}
                      strokeWidth={2}
                      aria-hidden="true"
                    />

                    <span>
                      {
                        getNavigationLabel(
                          item,
                          profile?.role,
                          hasPermission(
                            'shift_swaps.approve',
                          ),
                        )
                      }
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
            disabled={
              isSigningOut
            }
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
              onClick={
                toggleSidebar
              }
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
<div className="app-header-actions">
  <NotificationBell />

  <div className="app-user">
            <div
              className="app-user-avatar"
              aria-hidden="true"
            >
              {
                getInitial(
                  displayName,
                )
              }
            </div>

            <div className="app-user-details">
              <span className="app-user-name">
                {
                  displayName
                }
              </span>

              <span className="app-user-role">
                {
                  roleLabel
                }
              </span>
            </div>
          </div>
          </div>
        </header>

        <main className="app-main">
          <PushPermissionPrompt />

          <Outlet />
        </main>
        </div>
    </div>
     </NotificationProvider>
  </PushStatusProvider>
  );
}

export default AppLayout;