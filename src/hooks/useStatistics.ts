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
  year:
    number | null;

  month:
    number | null;
}

interface UseStatisticsResult {
  data:
    StatisticsDashboardResponse | null;

  filters:
    StatisticsFilterState;

  isLoading: boolean;

  error:
    string | null;

  setYear:
    (
      year:
        number | null,
    ) => void;

  setMonth:
    (
      month:
        number | null,
    ) => void;

  load:
    () => Promise<void>;

  clearError:
    () => void;
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'לא ניתן היה לטעון את נתוני הסטטיסטיקה.';
}

function getInitialFilters():
  StatisticsFilterState {
  const now =
    new Date();

  return {
    year:
      now.getFullYear(),

    month:
      now.getMonth() + 1,
  };
}

export function useStatistics():
  UseStatisticsResult {
  const [
    data,
    setData,
  ] =
    useState<StatisticsDashboardResponse | null>(
      null,
    );

  const [
    filters,
    setFilters,
  ] =
    useState<StatisticsFilterState>(
      getInitialFilters,
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  useEffect(
    () => {
      let isCancelled =
        false;

      async function fetchStatistics():
        Promise<void> {
        try {
          const response =
            await statisticsService
              .getStatisticsDashboard({
                year:
                  filters.year,

                month:
                  filters.month,
              });

          if (
            isCancelled
          ) {
            return;
          }

          setData(
            response,
          );

          setError(
            null,
          );
        } catch (
          loadError
        ) {
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

      void fetchStatistics();

      return () => {
        isCancelled =
          true;
      };
    },
    [
      filters.month,
      filters.year,
    ],
  );

  const load =
    useCallback(
      async (): Promise<void> => {
        setIsLoading(
          true,
        );

        setError(
          null,
        );

        try {
          const response =
            await statisticsService
              .getStatisticsDashboard({
                year:
                  filters.year,

                month:
                  filters.month,
              });

          setData(
            response,
          );
        } catch (
          loadError
        ) {
          setError(
            getErrorMessage(
              loadError,
            ),
          );
        } finally {
          setIsLoading(
            false,
          );
        }
      },
      [
        filters.month,
        filters.year,
      ],
    );

  const setYear =
    useCallback(
      (
        year:
          number | null,
      ): void => {
        setIsLoading(
          true,
        );

        setError(
          null,
        );

        setFilters(
          (
            currentFilters,
          ) => ({
            ...currentFilters,

            year,

            month:
              year ===
                null
                ? null
                : currentFilters.month,
          }),
        );
      },
      [],
    );

  const setMonth =
    useCallback(
      (
        month:
          number | null,
      ): void => {
        setIsLoading(
          true,
        );

        setError(
          null,
        );

        setFilters(
          (
            currentFilters,
          ) => ({
            ...currentFilters,

            month,
          }),
        );
      },
      [],
    );

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
    data,
    filters,
    isLoading,
    error,
    setYear,
    setMonth,
    load,
    clearError,
  };
}