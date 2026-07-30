import { NavLink, Outlet } from 'react-router-dom';

function AppLayout() {
  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="app-logo">
          <strong>GVK Shift Manager</strong>
          <span>מערכת ניהול משמרות</span>
        </div>

        <nav className="app-navigation" aria-label="ניווט ראשי">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? 'navigation-link navigation-link-active' : 'navigation-link'
            }
          >
            לוח בקרה
          </NavLink>

          <NavLink
            to="/schedule"
            className={({ isActive }) =>
              isActive ? 'navigation-link navigation-link-active' : 'navigation-link'
            }
          >
            שיבוץ מוקדנים
          </NavLink>

          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              isActive ? 'navigation-link navigation-link-active' : 'navigation-link'
            }
          >
            התראות
          </NavLink>
        </nav>
      </aside>

      <div className="app-content-wrapper">
        <header className="app-header">
          <span>GVK</span>
          <span>משתמש מחובר: נתנאל</span>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;