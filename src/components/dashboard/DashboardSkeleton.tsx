function DashboardSkeleton() {
  return (
    <div
      className="dashboard-skeleton"
      aria-label="טוען את לוח הבקרה"
      aria-busy="true"
    >
      <div className="dashboard-skeleton-hero">
        <span />
        <span />
        <span />
      </div>

      <div className="dashboard-skeleton-grid">
        {Array.from({
          length: 4,
        }).map(
          (
            _,
            index,
          ) => (
            <div
              key={
                index
              }
              className="dashboard-skeleton-card"
            >
              <span />
              <span />
              <span />
            </div>
          ),
        )}
      </div>
    </div>
  );
}

export default DashboardSkeleton;