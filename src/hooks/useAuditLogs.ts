/**
 * קובץ: src/hooks/useAuditLogs.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור יומן שינויים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: UseAuditLogsResult, getErrorMessage, getDateRange, useAuditLogs.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import { effectiveAuditAction, auditActionCategory } from '../utils/auditCatalog';
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

/**
 * חוזה הנתונים UseAuditLogsResult: יומן שינויים / תוצאה.
 */
interface UseAuditLogsResult {
  // auditLogsState — יומן שינויים / מצב.
  auditLogsState:
    AuditLogsState;

  // filteredEntries — רשומות.
  filteredEntries:
    AuditLogEntry[];

  // loadAuditLogs — יומן שינויים.
  loadAuditLogs:
    () => Promise<void>;

  // clearError — שגיאה.
  clearError:
    () => void;
}

// initialState — מצב.
const initialState:
  AuditLogsState = {
    entries:
      [],

    isLoading:
      true,

    error:
      null,
  };

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

  return 'אירעה שגיאה בלתי צפויה בטעינת יומן המערכת.';
}

/**
 * פעולה getDateRange: שליפה או חישוב של טווח התאריכים.
 * @param filters — מסננים.
 * @returns { from: Date | null; to: Date | null; } — הפלט בהתאם לחתימה.
 */
function getDateRange(
  filters:
    AuditLogFilters,
): {
  from: Date | null;
  to: Date | null;
} {
  const now =
    new Date();

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר filters.timeRange === 'today'.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר filters.timeRange === '7d' || filters.timeRange === '30d'.
  if (
    filters.timeRange ===
      '7d' ||
    filters.timeRange ===
      '30d'
  ) {
    // days — ימים.
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר filters.timeRange === 'custom'.
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

/**
 * פעולה useAuditLogs: חיבור מצב או הקשר עבור יומן שינויים.
 * @param filters — מסננים.
 * @returns UseAuditLogsResult — הפלט בהתאם לחתימה.
 */
export function useAuditLogs(
  filters:
    AuditLogFilters,
): UseAuditLogsResult {
  // מצב מקומי: auditLogsState — יומן שינויים / מצב; setAuditLogsState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    auditLogsState,
    setAuditLogsState,
  ] =
    useState<AuditLogsState>(
      initialState,
    );

  // loadAuditLogs — יומן שינויים.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // entries — רשומות.
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

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ loadAuditLogs, ].
  useEffect(
    () => {
      void loadAuditLogs();
    },
    [
      loadAuditLogs,
    ],
  );

  // ערך מחושב filteredEntries — רשומות; נשמר בין רינדורים עד שינוי התלויות.
  const filteredEntries =
    useMemo(
      () => {
        // normalizedSearchTerm — הנתון normalizedSearchTerm בהקשר הפעולה.
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
                effectiveAuditAction(entry) ===
                  filters.action;

              const matchesCategory = filters.category === 'all' ||
                auditActionCategory(effectiveAuditAction(entry), entry.entityType) === filters.category;

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

              // createdAt — מועד יצירה.
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
                matchesCategory &&
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

  // clearError — שגיאה.
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
