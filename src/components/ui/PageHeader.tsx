/**
 * קובץ: src/components/ui/PageHeader.tsx
 * מטרה: כותרת עמוד משותפת הכוללת את התוכן והפעולות שנמסרים לרכיב.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PageHeaderProps, PageHeader.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import type { ReactNode } from 'react';

/**
 * חוזה הנתונים PageHeaderProps: מאפייני הרכיב.
 */
interface PageHeaderProps {
  // title — כותרת.
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * פעולה PageHeader: הנתון PageHeader בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function PageHeader({
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header-title">{title}</h1>

        {description ? (
          <p className="page-header-description">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="page-actions">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export default PageHeader;
