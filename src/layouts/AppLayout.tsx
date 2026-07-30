import { NavLink, Outlet } from 'react-router-dom';
import '../styles/layout.css';

const getNavigationClassName = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'navigation-link navigation-link-active' : 'navigation-link';

function AppLayout() {
  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="app-logo">
          <strong>GVK Shift Manager</strong>
          <span>מערכת ניהול ושיבוץ משמרות</span>
        </div>

        <nav className="app-navigation" aria-label="ניווט ראשי">
          <NavLink to="/" end className={getNavigationClassName}>
            לוח בקרה
          </NavLink>

          <NavLink to="/schedule" className={getNavigationClassName}>
            שיבוץ מוקדנים
          </NavLink>

          <NavLink to="/notifications" className={getNavigationClassName}>
            התראות
          </NavLink>
        </nav>
      </aside>

      <div className="app-content-wrapper">
        <header className="app-header">
          <span className="app-header-brand">מערכת ניהול משמרות</span>

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