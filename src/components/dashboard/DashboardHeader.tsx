/**
 * קובץ: src/components/dashboard/DashboardHeader.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור לוח בקרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DashboardHeaderProps, formatCurrentDate, formatCurrentTime, DashboardHeader.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  RefreshCw,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  UserProfile,
} from '../../types/auth';

/**
 * חוזה הנתונים DashboardHeaderProps: לוח בקרה / מאפייני הרכיב.
 */
interface DashboardHeaderProps {
  // profile — פרופיל.
  profile:
    UserProfile | null;

  isRefreshing: boolean;

  onRefresh:
    () => Promise<void>;
}

/**
 * פעולה formatCurrentDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param date — תאריך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatCurrentDate(
  date: Date,
): string {
  return new Intl.DateTimeFormat(
    'he-IL',
    {
      weekday:
        'long',

      day:
        'numeric',

      month:
        'long',

      year:
        'numeric',
    },
  ).format(
    date,
  );
}

/**
 * פעולה formatCurrentTime: עיצוב ערך לתצוגה עבור זמן.
 * @param date — תאריך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatCurrentTime(
  date: Date,
): string {
  return new Intl.DateTimeFormat(
    'he-IL',
    {
      hour:
        '2-digit',

      minute:
        '2-digit',

      second:
        '2-digit',

      hour12:
        false,
    },
  ).format(
    date,
  );
}

/**
 * פעולה DashboardHeader: לוח בקרה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function DashboardHeader({
  profile,
  isRefreshing,
  onRefresh,
}: DashboardHeaderProps) {
  // מצב מקומי: now — הנתון now בהקשר הפעולה; setNow מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    now,
    setNow,
  ] =
    useState(
      () =>
        new Date(),
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(
    () => {
      // intervalId — מרווח זמן / מזהה.
      const intervalId =
        window.setInterval(
          () => {
            setNow(
              new Date(),
            );
          },
          1000,
        );

      return () => {
        window.clearInterval(
          intervalId,
        );
      };
    },
    [],
  );

  // displayName — שם תצוגה.
  const displayName =
    profile
      ?.displayName
      .trim() ||
    profile
      ?.scheduleName
      ?.trim() ||
    'משתמש';

  // ערך מחושב formattedDate — תאריך; נשמר בין רינדורים עד שינוי התלויות.
  const formattedDate =
    useMemo(
      () =>
        formatCurrentDate(
          now,
        ),
      [
        now,
      ],
    );

  // ערך מחושב formattedTime — זמן; נשמר בין רינדורים עד שינוי התלויות.
  const formattedTime =
    useMemo(
      () =>
        formatCurrentTime(
          now,
        ),
      [
        now,
      ],
    );

  return (
    <section className="dashboard-hero">
      <div className="dashboard-hero-content">
        <span className="dashboard-hero-eyebrow">
          לוח בקרה אישי
        </span>

        <h1>
          שלום {displayName}
        </h1>

        <p>
          {formattedDate}
        </p>
      </div>

      <div className="dashboard-hero-side">
        <strong className="dashboard-live-time">
          {formattedTime}
        </strong>

        <button
          type="button"
          className="dashboard-refresh-button"
          disabled={
            isRefreshing
          }
          onClick={() => {
            void onRefresh();
          }}
        >
          <RefreshCw
            size={17}
            className={
              isRefreshing
                ? 'dashboard-spin'
                : undefined
            }
            aria-hidden="true"
          />

          {isRefreshing
            ? 'מרענן...'
            : 'רענון'}
        </button>
      </div>
    </section>
  );
}

export default DashboardHeader;