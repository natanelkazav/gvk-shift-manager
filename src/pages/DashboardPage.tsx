function DashboardPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h1 className="page-header-title">לוח בקרה</h1>
          <p className="page-header-description">
            תמונת מצב כללית של מערכת המשמרות.
          </p>
        </div>

        <div className="page-actions">
          <button type="button" className="button button-secondary">
            צפייה בשיבוץ
          </button>

          <button type="button" className="button button-primary">
            יצירת שיבוץ
          </button>
        </div>
      </header>

      <div className="stats-grid">
        <article className="card stat-card">
          <p className="stat-label">משמרות החודש</p>
          <p className="stat-value">0</p>
        </article>

        <article className="card stat-card">
          <p className="stat-label">מוקדנים פעילים</p>
          <p className="stat-value">0</p>
        </article>

        <article className="card stat-card">
          <p className="stat-label">בקשות החלפה</p>
          <p className="stat-value">0</p>
        </article>

        <article className="card stat-card">
          <p className="stat-label">התראות פעילות</p>
          <p className="stat-value">0</p>
        </article>
      </div>

      <section className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">פעילות אחרונה</h2>
        </div>

        <div className="card-body">
          <p>עדיין אין פעילות להצגה.</p>

          <span className="badge badge-info">המערכת בהקמה</span>
        </div>
      </section>
    </>
  );
}

export default DashboardPage;