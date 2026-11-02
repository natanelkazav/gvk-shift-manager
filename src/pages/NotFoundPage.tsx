/**
 * קובץ: src/pages/NotFoundPage.tsx
 * מטרה: הצגת מסך עבור כתובת שאינה תואמת למסלול מוכר ביישום.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: NotFoundPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { Link } from 'react-router-dom';

/**
 * פעולה NotFoundPage: הנתון NotFoundPage בהקשר הפעולה.
 */
function NotFoundPage() {
  return (
    <section>
      <h1>העמוד לא נמצא</h1>
      <p>הכתובת שאליה הגעת אינה קיימת.</p>

      <Link to="/">חזרה ללוח הבקרה</Link>
    </section>
  );
}

export default NotFoundPage;