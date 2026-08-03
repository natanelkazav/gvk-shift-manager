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

interface DashboardHeaderProps {
  profile:
    UserProfile | null;

  isRefreshing: boolean;

  onRefresh:
    () => Promise<void>;
}

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

function DashboardHeader({
  profile,
  isRefreshing,
  onRefresh,
}: DashboardHeaderProps) {
  const [
    now,
    setNow,
  ] =
    useState(
      () =>
        new Date(),
    );

  useEffect(
    () => {
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

  const displayName =
    profile
      ?.displayName
      .trim() ||
    profile
      ?.scheduleName
      ?.trim() ||
    'משתמש';

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