/**
 * קובץ: src/components/dashboard/DashboardSkeleton.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור לוח בקרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DashboardSkeleton.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
/**
 * פעולה DashboardSkeleton: לוח בקרה.
 */
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