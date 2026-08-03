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

interface UseDashboardResult {
  dashboard:
    DashboardResponse | null;

  isLoading: boolean;

  isRefreshing: boolean;

  error:
    string | null;

  refresh:
    () => Promise<void>;

  clearError:
    () => void;
}

const ACTIVE_REFRESH_INTERVAL_MS =
  30 * 1000;

const IDLE_REFRESH_INTERVAL_MS =
  5 * 60 * 1000;

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'לא ניתן היה לטעון את לוח הבקרה.';
}

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
      ?.manager
      ?.currentDispatcher ||
    dashboard
      ?.manager
      ?.currentDriver,
  );
}

export function useDashboard():
  UseDashboardResult {
  const [
    dashboard,
    setDashboard,
  ] =
    useState<DashboardResponse | null>(
      null,
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] =
    useState(false);

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

      async function loadInitialDashboard():
        Promise<void> {
        try {
          const response =
            await dashboardService
              .getMyDashboard();

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

  useEffect(
    () => {
      let isCancelled =
        false;

      const intervalId =
        window.setInterval(
          () => {
            void (async () => {
              try {
                const response =
                  await dashboardService
                    .getMyDashboard();

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

        try {
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