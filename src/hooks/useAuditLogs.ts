import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  auditService,
} from '../services/auditService';

import type {
  AuditLogEntry,
  AuditLogFilters,
  AuditLogsState,
} from '../types/audit';

interface UseAuditLogsResult {
  auditLogsState:
    AuditLogsState;

  filteredEntries:
    AuditLogEntry[];

  loadAuditLogs:
    () => Promise<void>;

  clearError:
    () => void;
}

const initialState:
  AuditLogsState = {
    entries:
      [],

    isLoading:
      true,

    error:
      null,
  };

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה בטעינת יומן המערכת.';
}

function getDateRange(
  filters:
    AuditLogFilters,
): {
  from: Date | null;
  to: Date | null;
} {
  const now =
    new Date();

  if (
    filters.timeRange ===
      'today'
  ) {
    const from =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

    return {
      from,
      to:
        now,
    };
  }

  if (
    filters.timeRange ===
      '7d' ||
    filters.timeRange ===
      '30d'
  ) {
    const days =
      filters.timeRange ===
        '7d'
        ? 7
        : 30;

    const from =
      new Date(
        now.getTime() -
          days *
          24 *
          60 *
          60 *
          1000,
      );

    return {
      from,
      to:
        now,
    };
  }

  if (
    filters.timeRange ===
      'custom'
  ) {
    const from =
      filters.dateFrom
        ? new Date(
            `${filters.dateFrom}T00:00:00`,
          )
        : null;

    const to =
      filters.dateTo
        ? new Date(
            `${filters.dateTo}T23:59:59.999`,
          )
        : null;

    return {
      from:
        from &&
        !Number.isNaN(
          from.getTime(),
        )
          ? from
          : null,

      to:
        to &&
        !Number.isNaN(
          to.getTime(),
        )
          ? to
          : null,
    };
  }

  return {
    from:
      null,
    to:
      null,
  };
}

export function useAuditLogs(
  filters:
    AuditLogFilters,
): UseAuditLogsResult {
  const [
    auditLogsState,
    setAuditLogsState,
  ] =
    useState<AuditLogsState>(
      initialState,
    );

  const loadAuditLogs =
    useCallback(
      async (): Promise<void> => {
        setAuditLogsState(
          (
            currentState,
          ) => ({
            ...currentState,

            isLoading:
              true,

            error:
              null,
          }),
        );

        try {
          const entries =
            await auditService
              .getAuditLogs({
                limit:
                  1000,
              });

          setAuditLogsState({
            entries,

            isLoading:
              false,

            error:
              null,
          });
        } catch (
          error
        ) {
          setAuditLogsState(
            (
              currentState,
            ) => ({
              ...currentState,

              isLoading:
                false,

              error:
                getErrorMessage(
                  error,
                ),
            }),
          );
        }
      },
      [],
    );

  useEffect(
    () => {
      void loadAuditLogs();
    },
    [
      loadAuditLogs,
    ],
  );

  const filteredEntries =
    useMemo(
      () => {
        const normalizedSearchTerm =
          filters.searchTerm
            .trim()
            .toLowerCase();

        const {
          from,
          to,
        } =
          getDateRange(
            filters,
          );

        return auditLogsState
          .entries
          .filter(
            (
              entry,
            ) => {
              const matchesAction =
                filters.action ===
                  'all' ||
                entry.action ===
                  filters.action;

              const searchableText = [
                entry.summary,
                entry.actorDisplayName,
                entry.actorEmail,
                entry.targetDisplayName,
                entry.targetEmail,
                entry.entityType,
              ]
                .filter(
                  (
                    value,
                  ): value is string =>
                    Boolean(
                      value,
                    ),
                )
                .join(
                  ' ',
                )
                .toLowerCase();

              const matchesSearch =
                !normalizedSearchTerm ||
                searchableText.includes(
                  normalizedSearchTerm,
                );

              const createdAt =
                new Date(
                  entry.createdAt,
                );

              const matchesFrom =
                !from ||
                (
                  !Number.isNaN(
                    createdAt.getTime(),
                  ) &&
                  createdAt >=
                    from
                );

              const matchesTo =
                !to ||
                (
                  !Number.isNaN(
                    createdAt.getTime(),
                  ) &&
                  createdAt <=
                    to
                );

              return (
                matchesAction &&
                matchesSearch &&
                matchesFrom &&
                matchesTo
              );
            },
          );
      },
      [
        auditLogsState.entries,
        filters,
      ],
    );

  const clearError =
    useCallback(
      (): void => {
        setAuditLogsState(
          (
            currentState,
          ) => ({
            ...currentState,

            error:
              null,
          }),
        );
      },
      [],
    );

  return {
    auditLogsState,

    filteredEntries,

    loadAuditLogs,

    clearError,
  };
}
