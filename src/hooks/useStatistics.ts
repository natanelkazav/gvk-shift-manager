/**
 * קובץ: src/hooks/useStatistics.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור סטטיסטיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: StatisticsFilterState, UseStatisticsResult, getErrorMessage, getInitialFilters, useStatistics.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  statisticsService,
} from '../services/statisticsService';

import type {
  StatisticsDashboardResponse,
} from '../types/statistics';

/**
 * חוזה הנתונים StatisticsFilterState: סטטיסטיקה / סינון / מצב.
 */
interface StatisticsFilterState {
  // years — שנים.
  years: number[];
  // months — חודשים.
  months: number[];
}

/**
 * חוזה הנתונים UseStatisticsResult: סטטיסטיקה / תוצאה.
 */
interface UseStatisticsResult {
  // data — נתונים.
  data:
    StatisticsDashboardResponse | null;
  // filters — מסננים.
  filters: StatisticsFilterState;
  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;
  // error — שגיאה.
  error: string | null;
  setYears: (years: number[]) => void;
  setMonths: (months: number[]) => void;
  load: () => Promise<void>;
  // clearError — שגיאה.
  clearError: () => void;
}

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (error instanceof Error) {
    return error.message;
  }

  return 'לא ניתן היה לטעון את נתוני הסטטיסטיקה.';
}

/**
 * פעולה getInitialFilters: שליפה או חישוב של מסננים.
 * @returns StatisticsFilterState — הפלט בהתאם לחתימה.
 */
function getInitialFilters():
  StatisticsFilterState {
  const now = new Date();

  return {
    years: [now.getFullYear()],
    months: [now.getMonth() + 1],
  };
}

/**
 * פעולה useStatistics: חיבור מצב או הקשר עבור סטטיסטיקה.
 * @returns UseStatisticsResult — הפלט בהתאם לחתימה.
 */
export function useStatistics():
  UseStatisticsResult {
  // מצב מקומי: data — נתונים; setData מעדכנת אותו ומפעילה רינדור לפי React.
  const [data, setData] =
    useState<StatisticsDashboardResponse | null>(
      null,
    );

  // מצב מקומי: filters — מסננים; setFilters מעדכנת אותו ומפעילה רינדור לפי React.
  const [filters, setFilters] =
    useState<StatisticsFilterState>(
      getInitialFilters,
    );

  // מצב מקומי: isLoading — האם טעינה מתבצעת; setIsLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [isLoading, setIsLoading] =
    useState(true);

  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] =
    useState<string | null>(null);

  // fetchStatistics — סטטיסטיקה.
  const fetchStatistics =
    useCallback(
      async (): Promise<StatisticsDashboardResponse> =>
        statisticsService
          .getStatisticsDashboard({
            years: filters.years,
            months: filters.months,
          }),
      [
        filters.months,
        filters.years,
      ],
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [fetchStatistics].
  useEffect(() => {
    // isCancelled — הנתון isCancelled בהקשר הפעולה.
    let isCancelled = false;

    /**
     * פעולה אסינכרונית run: הנתון run בהקשר הפעולה.
     * @returns Promise<void> — הפלט בהתאם לחתימה.
     */
    const run = async (): Promise<void> => {
      setIsLoading(true);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // response — תוצאת הפעולה.
        const response =
          await fetchStatistics();

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
        if (isCancelled) {
          return;
        }

        setData(response);
        setError(null);
      } catch (loadError) {
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isCancelled.
        if (isCancelled) {
          return;
        }

        setError(
          getErrorMessage(
            loadError,
          ),
        );
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, [fetchStatistics]);

  const load = useCallback(
    async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        setData(
          await fetchStatistics(),
        );
      } catch (loadError) {
        setError(
          getErrorMessage(
            loadError,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [fetchStatistics],
  );

  // setYears — קבוצה ייחודית / שנים.
  const setYears = useCallback(
    (years: number[]): void => {
      setError(null);
      setFilters(
        (currentFilters) => ({
          years,
          months:
            years.length === 0
              ? []
              : currentFilters.months,
        }),
      );
    },
    [],
  );

  // setMonths — קבוצה ייחודית / חודשים.
  const setMonths = useCallback(
    (months: number[]): void => {
      setError(null);
      setFilters(
        (currentFilters) => ({
          ...currentFilters,
          months,
        }),
      );
    },
    [],
  );

  // clearError — שגיאה.
  const clearError = useCallback(
    (): void => {
      setError(null);
    },
    [],
  );

  return {
    data,
    filters,
    isLoading,
    error,
    setYears,
    setMonths,
    load,
    clearError,
  };
}
