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

import PwaUpdatePrompt
  from '../features/pwa/components/PwaUpdatePrompt';

import AppVersionReporter from '../features/appVersion/components/AppVersionReporter';

import NotificationClickHandler
  from '../features/notifications/components/NotificationClickHandler';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import NotificationBell
  from '../features/notifications/components/NotificationBell';

import HelpCenter
  from '../components/help/HelpCenter';

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

import { dynamicSchedulingService } from '../services/dynamicSchedulingService';
import { dynamicRuntimeService } from '../services/dynamicRuntimeService';
import { dynamicCutoverService } from '../services/dynamicCutoverService';
import type { DynamicRuntimeContext } from '../types/dynamicRuntime';

import '../styles/layout.css';
import { DevelopmentModeProvider } from '../features/developmentMode/DevelopmentModeProvider';
import DevelopmentModeBanner from '../features/developmentMode/DevelopmentModeBanner';

interface NavigationItem {
  label: string;

  path: string;

  end?: boolean;

  icon: typeof LayoutDashboard;

  requiredPermissions:
    readonly PermissionKey[];

  runtimeMode?: 'dynamic' | 'legacy' | 'all';

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
        'האילוצים שלי',

      path:
        '/my-availability',

      icon:
        ClipboardList,

      requiredPermissions: [],
      runtimeMode: 'dynamic',
    },
    {
      label:
        'המשמרות שלי',

      path:
        '/my-shifts',

      icon:
        CalendarDays,

      requiredPermissions: [],
      runtimeMode: 'dynamic',
    },
    {
      label:
        'חילופי משמרות',

      path:
        '/my-shift-exchanges',

      icon:
        Repeat2,

      requiredPermissions: [],
      runtimeMode: 'dynamic',
    },
    {
      label:
        'שיבוצים',

      path:
        '/shifts',

      icon:
        CalendarDays,

      requiredPermissions: [],
      runtimeMode: 'dynamic',
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
      runtimeMode: 'legacy',

    },

{
  label: 'אילוצי מוקדנים',
  path: '/availability',
  icon: ClipboardList,

  requiredPermissions: [
    'availability.view',
    'availability.manage',
  ],
  runtimeMode: 'legacy',
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
    'driver_schedule.edit_any',
  ],
      runtimeMode: 'legacy',
    },

{
  label: 'אילוצי כוננות בוקר',
  path: '/morning-driver-availability',
  icon: SunMedium,

  requiredPermissions: [
    'morning_driver_availability.view',
    'morning_driver_availability.manage',
  ],
  runtimeMode: 'legacy',
},
    {
      label: 'לוח כוננויות בוקר',
      path: '/morning-driver-schedule',
      icon: CalendarDays,

      requiredPermissions: [
        'morning_driver_schedule.view',
        'morning_driver_schedule.view_team',
        'morning_driver_schedule.edit',
        'morning_driver_schedule.edit_any',
      ],
      runtimeMode: 'legacy',
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
        'announcements.send',
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
],
      runtimeMode: 'legacy',
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

      requiredPermissions: [],
    },
  ];

function getNavigationLabel(
  item:
    NavigationItem,

  canApproveShiftSwaps:
    boolean,

  hasPermission:
    (permission: PermissionKey) => boolean,
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
    item.path ===
      '/schedule' &&
    hasPermission(
      'schedule.view',
    )
  ) {
    return 'המשמרות שלי';
  }

  if (
    item.path ===
      '/availability' &&
    hasPermission(
      'availability.view',
    )
  ) {
    return 'האילוצים שלי';
  }

  if (
    item.path ===
      '/driver-schedule' &&
    hasPermission(
      'driver_schedule.view',
    )
  ) {
    return 'הכוננויות שלי';
  }

  if (
    item.path ===
      '/morning-driver-schedule' &&
    hasPermission(
      'morning_driver_schedule.view',
    )
  ) {
    return 'לוח כוננויות בוקר';
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
      'מנהל',

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

    const [dynamicFirstActive, setDynamicFirstActive] = useState(false);

const [
    dynamicRuntimeContext,
    setDynamicRuntimeContext,
  ] = useState<DynamicRuntimeContext | null>(null);

  const [
    hasDynamicAvailability,
    setHasDynamicAvailability,
  ] = useState(false);


  const [
    hasDynamicPublishedSchedule,
    setHasDynamicPublishedSchedule,
  ] = useState(false);

  const [
    hasDynamicShiftExchange,
    setHasDynamicShiftExchange,
  ] = useState(false);

  const [
    hasDynamicManagementWorkspace,
    setHasDynamicManagementWorkspace,
  ] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([dynamicRuntimeService.getMyRuntimeContext(), dynamicCutoverService.getState()])
      .then(([context, cutover]) => {
        if (!active) return;

        // Dynamic-first is also the default operational shell for system
        // administrators and Job Type managers. They do not need to be members
        // of an employee Job Type just to receive the new management navigation.
        const canUseDynamicManagement =
          profile?.role === 'admin' ||
          context.canManageDynamicScheduling ||
          context.managedRoles.length > 0;

        setDynamicRuntimeContext(context);
        setDynamicFirstActive(
          cutover.dynamicFirstEnabled &&
          (cutover.useDynamicRuntime || canUseDynamicManagement),
        );
      })
      .catch(() => { if (active) { setDynamicRuntimeContext(null); setDynamicFirstActive(false); } });
    return () => { active = false; };
  }, [profile?.id, profile?.role]);

  useEffect(() => {
    let active = true;

    // Employee-only roles (including "ללא שיבוצים") must not probe a
    // manager-only RPC. Besides noisy 400/not-allowed responses, that probe
    // has no value for their navigation.
    const canProbeManagementWorkspace =
      profile?.role === 'admin' ||
      dynamicRuntimeContext?.canManageDynamicScheduling === true ||
      (dynamicRuntimeContext?.managedRoles.length ?? 0) > 0;

    if (!dynamicFirstActive || !canProbeManagementWorkspace) {
      setHasDynamicManagementWorkspace(false);
      return () => { active = false; };
    }

    const now = new Date();
    void dynamicSchedulingService
      .getShiftsManagementWorkspace(now.getFullYear(), now.getMonth() + 1)
      .then((workspace) => {
        if (active) setHasDynamicManagementWorkspace(workspace.roles.length > 0);
      })
      .catch(() => {
        if (active) setHasDynamicManagementWorkspace(false);
      });

    return () => {
      active = false;
    };
  }, [profile?.id, profile?.role, dynamicFirstActive, dynamicRuntimeContext]);

  useEffect(() => {
    let active = true;
    void dynamicSchedulingService.getMyDynamicAvailabilityPeriods()
      .then((periods) => { if (active) setHasDynamicAvailability(periods.length > 0); })
      .catch(() => { if (active) setHasDynamicAvailability(false); });
    return () => { active = false; };
  }, [profile?.id]);


  useEffect(() => {
    let active = true;
    void dynamicSchedulingService.getMyDynamicSchedulePeriods()
      .then((periods) => {
        if (!active) return;
        setHasDynamicPublishedSchedule(periods.length > 0);
        // Navigation capability must be derived from the published dynamic
        // schedules the user can actually see, not from the exchange-options
        // RPC. The options RPC intentionally filters to current/next-month
        // requestable data and can therefore return an empty result while a
        // valid published dynamic schedule is already visible in "המשמרות שלי".
        // That mismatch caused users to stay on the legacy /shift-swaps page.
        setHasDynamicShiftExchange(
          periods.some((period) => period.scheduleChangeMode === 'shift_exchange'),
        );
      })
      .catch(() => {
        if (!active) return;
        setHasDynamicPublishedSchedule(false);
        setHasDynamicShiftExchange(false);
      });
    return () => { active = false; };
  }, [profile?.id]);

const visibleNavigationItems =
  useMemo(
    () =>
      navigationItems.filter(
        (item) => {
          const mode = item.runtimeMode ?? 'all';

          // Phase 10.5 creates a hard UX boundary: a user sees either the
          // Dynamic-first navigation or the Legacy-first navigation, never a
          // mixture of both. The legacy pages are still available under
          // /legacy/* for explicit recovery by administrators.
          if (mode === 'dynamic' && !dynamicFirstActive) return false;
          if (mode === 'legacy' && dynamicFirstActive) return false;

          const hasRequiredPermission =
            item.requiredPermissions.length === 0 ||
            item.requiredPermissions.some((permission) =>
              hasPermission(permission),
            );

          if (!hasRequiredPermission) return false;

          // Account-level access and employee relevance are intentionally
          // different concepts. A system administrator may be allowed to
          // inspect every capability, but that must not fill the sidebar with
          // personal employee workspaces.
          const isPersonalDynamicWorkspace =
            item.path === '/my-availability' ||
            item.path === '/my-shifts' ||
            item.path === '/my-shift-exchanges';

          if (profile?.role === 'admin' && isPersonalDynamicWorkspace) {
            return false;
          }

          if (item.path === '/my-availability' && !hasDynamicAvailability) {
            return false;
          }

          if (item.path === '/my-shifts' && !hasDynamicPublishedSchedule) {
            return false;
          }

          if (item.path === '/my-shift-exchanges' && !hasDynamicShiftExchange) {
            return false;
          }

          if (item.path === '/shifts' && !hasDynamicManagementWorkspace) {
            return false;
          }

          return true;
        },
      ),
    [
      hasPermission,
      hasDynamicAvailability,
      hasDynamicPublishedSchedule,
      hasDynamicShiftExchange,
      hasDynamicManagementWorkspace,
      dynamicFirstActive,
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
    dynamicRuntimeContext?.hasDynamicMemberships
      ? dynamicRuntimeContext.primaryJobTypeName ?? 'תפקיד דינמי'
      : profile
        ? roleLabels[profile.role]
        : '';

return (
<DevelopmentModeProvider>
<PushStatusProvider>
  <NotificationProvider>
    <NotificationClickHandler />
    <AppVersionReporter />
    <div className="app-layout">
      <DevelopmentModeBanner />
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
              צוות GVK
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
                      {item.path === '/shift-swaps' && hasDynamicShiftExchange
                        ? 'החלפות משמרת (מערכת ישנה)'
                        : item.path === '/my-shift-exchanges'
                          ? 'חילופי משמרות'
                          : getNavigationLabel(
                              item,
                              hasPermission(
                                'shift_swaps.approve',
                              ),
                              hasPermission,
                            )}
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
  <HelpCenter />

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
          <PwaUpdatePrompt />

          <PushPermissionPrompt />

          <Outlet />
        </main>
        </div>
    </div>
     </NotificationProvider>
  </PushStatusProvider>
</DevelopmentModeProvider>
  );
}

export default AppLayout;