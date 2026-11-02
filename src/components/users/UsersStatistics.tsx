/**
 * קובץ: src/components/users/UsersStatistics.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור משתמשים / סטטיסטיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UsersStatisticsProps, UsersStatistics.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  Users,
} from 'lucide-react';

/**
 * חוזה הנתונים UsersStatisticsProps: משתמשים / סטטיסטיקה / מאפייני הרכיב.
 */
interface UsersStatisticsProps {
  // total — סך הכול.
  total: number;
  // active — פעיל.
  active: number;
  inactive: number;
  admins: number;
}

/**
 * פעולה UsersStatistics: משתמשים / סטטיסטיקה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function UsersStatistics({
  total,
  active,
  inactive,
  admins,
}: UsersStatisticsProps) {
  return (
    <div className="users-statistics">
      <article className="users-stat-card">
        <Users
          size={22}
          aria-hidden="true"
        />

        <div>
          <span>סה״כ משתמשים</span>

          <strong>{total}</strong>
        </div>
      </article>

      <article className="users-stat-card">
        <UserRoundCheck
          size={22}
          aria-hidden="true"
        />

        <div>
          <span>משתמשים פעילים</span>

          <strong>{active}</strong>
        </div>
      </article>

      <article className="users-stat-card">
        <UserRoundX
          size={22}
          aria-hidden="true"
        />

        <div>
          <span>משתמשים מושבתים</span>

          <strong>{inactive}</strong>
        </div>
      </article>

      <article className="users-stat-card">
        <ShieldCheck
          size={22}
          aria-hidden="true"
        />

        <div>
          <span>מנהלי מערכת</span>

          <strong>{admins}</strong>
        </div>
      </article>
    </div>
  );
}

export default UsersStatistics;