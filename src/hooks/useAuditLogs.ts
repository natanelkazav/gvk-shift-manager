import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { auditService } from '../services/auditService';
import type {
  AuditLogEntry,
  AuditLogFilters,
  AuditLogsState,
} from '../types/audit';

interface UseAuditLogsResult {
  auditLogsState: AuditLogsState;
  filteredEntries: AuditLogEntry[];
  loadAuditLogs: () => Promise<void>;
  clearError: () => void;
}

const initialState: AuditLogsState = {
  entries: [],
  isLoading: true,
  error: null,
};

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה בטעינת יומן המערכת.';
}

export function useAuditLogs(
  filters: AuditLogFilters,
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
          (currentState) => ({
            ...currentState,
            isLoading: true,
            error: null,
          }),
        );

        try {
          const entries =
            await auditService
              .getAuditLogs({
                limit: 250,
              });

          setAuditLogsState({
            entries,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          setAuditLogsState(
            (currentState) => ({
              ...currentState,
              isLoading: false,
              error:
                getErrorMessage(error),
            }),
          );
        }
      },
      [],
    );

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const filteredEntries =
    useMemo(() => {
      const normalizedSearchTerm =
        filters.searchTerm
          .trim()
          .toLowerCase();

      return auditLogsState.entries.filter(
        (entry) => {
          const matchesAction =
            filters.action === 'all' ||
            entry.action ===
              filters.action;

          const searchableText = [
            entry.summary,
            entry.actorDisplayName,
            entry.actorEmail,
            entry.targetDisplayName,
            entry.targetEmail,
          ]
            .filter(
              (
                value,
              ): value is string =>
                Boolean(value),
            )
            .join(' ')
            .toLowerCase();

          const matchesSearch =
            !normalizedSearchTerm ||
            searchableText.includes(
              normalizedSearchTerm,
            );

          return (
            matchesAction &&
            matchesSearch
          );
        },
      );
    }, [
      auditLogsState.entries,
      filters,
    ]);

  const clearError =
    useCallback((): void => {
      setAuditLogsState(
        (currentState) => ({
          ...currentState,
          error: null,
        }),
      );
    }, []);

  return {
    auditLogsState,
    filteredEntries,
    loadAuditLogs,
    clearError,
  };
}