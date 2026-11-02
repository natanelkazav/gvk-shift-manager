/**
 * קובץ: src/hooks/useDashboard.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור לוח בקרה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UseDashboardResult, getErrorMessage, hasActiveAssignment, useDashboard, loadInitialDashboard.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  dashboardService,
} from '../services/dashboardService';

import type {
  DashboardResponse,
} from '../types/dashboard';

/**
 * חוזה הנתונים UseDashboardResult: לוח בקרה / תוצאה.
 */
interface UseDashboardResult {
  // dashboard — לוח בקרה.
  dashboard:
    DashboardResponse | null;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  isRefreshing: boolean;

  // error — שגיאה.
  error:
    string | null;

  refresh:
    () => Promise<void>;

  // clearError — שגיאה.
  clearError:
    () => void;
}

// ACTIVE_REFRESH_INTERVAL_MS — פעיל / מרווח זמן.
const ACTIVE_REFRESH_INTERVAL_MS =
  30 * 1000;

// IDLE_REFRESH_INTERVAL_MS — מרווח זמן.
const IDLE_REFRESH_INTERVAL_MS =
  5 * 60 * 1000;

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'לא ניתן היה לטעון את לוח הבקרה.';
}

/**
 * פעולה hasActiveAssignment: בדיקת קיום עבור פעיל / הקצאה.
 * @param dashboard — לוח בקרה.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function hasActiveAssignment(
  dashboard:
    DashboardResponse | null,
): boolean {
  return Boolean(
    dashboard
      ?.dispatcher
      ?.currentShift ||
    dashboard
      ?.driver
      ?.currentDuty ||
    dashboard
      ?.morningDriver
      ?.currentShift ||
    dashboard
      ?.manager
      ?.currentDispatcher ||
    dashboard
      ?.manager
      ?.currentDriver,
  );
}

/**
 * פעולה useDashboard: חיבור מצב או הקשר עבור לוח בקרה.
 * @returns UseDashboardResult — הפלט בהתאם לחתימה.
 */
export function useDashboard():
  UseDashboardResult {
  // מצב מקומי: dashboard — לוח בקרה; setDashboard מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    dashboard,
    setDashboard,
  ] =
    useState<DashboardResponse | null>(
      null,
    );

  // מצב מקומי: isLoading — האם טעינה מתבצעת; setIsLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  // מצב מקומי: isRefreshing — הנתון isRefreshing בהקשר הפעולה; setIsRefreshing מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(
    () => {
      // isCancelled — הנתון isCancelled בהקשר הפעולה.
      let isCancelled =
        false;

      /**
       * פעולה אסינכרונית loadInitialDashboard: טעינת לוח בקרה.
       * @returns Promise<void> — הפלט בהתאם לחתימה.
       */
      async function loadInitialDashboard():
        Promise<void> {
        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // response — תוצאת הפעולה.
          const response =
            await dashboardService
              .getMyDashboard();

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
          if (
            isCancelled
          ) {
            return;
          }

          setDashboard(
            response,
          );

          setError(
            null,
          );
        } catch (
          loadError
        ) {
          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
          if (
            isCancelled
          ) {
            return;
          }

          setError(
            getErrorMessage(
              loadError,
            ),
          );
        } finally {
          if (
            !isCancelled
          ) {
            setIsLoading(
              false,
            );
          }
        }
      }

      void loadInitialDashboard();

      return () => {
        isCancelled =
          true;
      };
    },
    [],
  );

  // ערך מחושב refreshIntervalMs — מרווח זמן; נשמר בין רינדורים עד שינוי התלויות.
  const refreshIntervalMs =
    useMemo(
      () =>
        hasActiveAssignment(
          dashboard,
        )
          ? ACTIVE_REFRESH_INTERVAL_MS
          : IDLE_REFRESH_INTERVAL_MS,
      [
        dashboard,
      ],
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ refreshIntervalMs, ].
  useEffect(
    () => {
      // isCancelled — הנתון isCancelled בהקשר הפעולה.
      let isCancelled =
        false;

      // intervalId — מרווח זמן / מזהה.
      const intervalId =
        window.setInterval(
          () => {
            void (async () => {
              // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
              try {
                // response — תוצאת הפעולה.
                const response =
                  await dashboardService
                    .getMyDashboard();

                // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
                if (
                  isCancelled
                ) {
                  return;
                }

                setDashboard(
                  response,
                );

                setError(
                  null,
                );
              } catch (
                refreshError
              ) {
                // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
                if (
                  isCancelled
                ) {
                  return;
                }

                setError(
                  getErrorMessage(
                    refreshError,
                  ),
                );
              }
            })();
          },
          refreshIntervalMs,
        );

      return () => {
        isCancelled =
          true;

        window.clearInterval(
          intervalId,
        );
      };
    },
    [
      refreshIntervalMs,
    ],
  );

  const refresh =
    useCallback(
      async (): Promise<void> => {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isRefreshing.
        if (
          isRefreshing
        ) {
          return;
        }

        setIsRefreshing(
          true,
        );

        setError(
          null,
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // response — תוצאת הפעולה.
          const response =
            await dashboardService
              .getMyDashboard();

          setDashboard(
            response,
          );
        } catch (
          refreshError
        ) {
          setError(
            getErrorMessage(
              refreshError,
            ),
          );
        } finally {
          setIsRefreshing(
            false,
          );
        }
      },
      [
        isRefreshing,
      ],
    );

  // clearError — שגיאה.
  const clearError =
    useCallback(
      (): void => {
        setError(
          null,
        );
      },
      [],
    );

  return {
    dashboard,
    isLoading,
    isRefreshing,
    error,
    refresh,
    clearError,
  };
}