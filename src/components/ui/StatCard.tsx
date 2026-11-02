/**
 * קובץ: src/components/ui/StatCard.tsx
 * מטרה: כרטיס להצגת מדד סטטיסטי והמידע הנלווה אליו.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: StatCardProps, StatCard.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { Card } from './Card';

/**
 * חוזה הנתונים StatCardProps: מאפייני הרכיב.
 */
interface StatCardProps {
  // label — תווית.
  label: string;
  // value — ערך.
  value: string | number;
}

/**
 * פעולה StatCard: הנתון StatCard בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function StatCard({
  label,
  value,
}: StatCardProps) {
  return (
    <Card className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </Card>
  );
}

export default StatCard;