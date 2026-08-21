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

interface StatisticsFilterState {
  years: number[];
  months: number[];
}

interface UseStatisticsResult {
  data:
    StatisticsDashboardResponse | null;
  filters: StatisticsFilterState;
  isLoading: boolean;
  error: string | null;
  setYears: (years: number[]) => void;
  setMonths: (months: number[]) => void;
  load: () => Promise<void>;
  clearError: () => void;
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'לא ניתן היה לטעון את נתוני הסטטיסטיקה.';
}

function getInitialFilters():
  StatisticsFilterState {
  const now = new Date();

  return {
    years: [now.getFullYear()],
    months: [now.getMonth() + 1],
  };
}

export function useStatistics():
  UseStatisticsResult {
  const [data, setData] =
    useState<StatisticsDashboardResponse | null>(
      null,
    );

  const [filters, setFilters] =
    useState<StatisticsFilterState>(
      getInitialFilters,
    );

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

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

  useEffect(() => {
    let isCancelled = false;

    const run = async (): Promise<void> => {
      setIsLoading(true);

      try {
        const response =
          await fetchStatistics();

        if (isCancelled) {
          return;
        }

        setData(response);
        setError(null);
      } catch (loadError) {
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
