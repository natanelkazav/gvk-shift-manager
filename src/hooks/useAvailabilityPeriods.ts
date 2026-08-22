import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { availabilityService } from '../services/availabilityService';
import type {
  AvailabilityPeriod,
  CloseAvailabilityPeriodResult,
  CreateAvailabilityPeriodInput,
  CreateAvailabilityPeriodResult,
  DeleteAvailabilityPeriodResult,
  ImportSpecialDaysResult,
  OpenAvailabilityPeriodResult,
  ReopenAvailabilityPeriodResult,
  RebuildAvailabilityPeriodResult,
} from '../types/availability';

interface AvailabilityPeriodsState {
  periods: AvailabilityPeriod[];

  isLoading: boolean;
  isCreating: boolean;
  isImportingSpecialDays: boolean;

  rebuildingPeriodId: string | null;
  openingPeriodId: string | null;
  closingPeriodId: string | null;
  reopeningPeriodId: string | null;
  deletingPeriodId: string | null;

  error: string | null;

  lastCreatedResult:
    CreateAvailabilityPeriodResult | null;

  lastImportResult:
    ImportSpecialDaysResult | null;

  lastRebuildResult:
    RebuildAvailabilityPeriodResult | null;

  lastOpenedResult:
    OpenAvailabilityPeriodResult | null;

  lastClosedResult:
    CloseAvailabilityPeriodResult | null;

  lastReopenedResult:
    ReopenAvailabilityPeriodResult | null;

  lastDeletedResult:
    DeleteAvailabilityPeriodResult | null;
}

interface UseAvailabilityPeriodsResult {
  state: AvailabilityPeriodsState;

  loadPeriods:
    () => Promise<void>;

  createPeriod: (
    input: CreateAvailabilityPeriodInput,
  ) => Promise<CreateAvailabilityPeriodResult>;

  importSpecialDays: (
    year: number,
  ) => Promise<ImportSpecialDaysResult>;

  rebuildPeriodSlots: (
    periodId: string,
  ) => Promise<RebuildAvailabilityPeriodResult>;

  openPeriod: (
    periodId: string,
  ) => Promise<OpenAvailabilityPeriodResult>;

  closePeriod: (
    periodId: string,
  ) => Promise<CloseAvailabilityPeriodResult>;

  reopenPeriod: (
    periodId: string,
  ) => Promise<ReopenAvailabilityPeriodResult>;

  deletePeriod: (
    periodId: string,
  ) => Promise<DeleteAvailabilityPeriodResult>;

  clearError:
    () => void;

  clearCreatedResult:
    () => void;

  clearImportResult:
    () => void;

  clearRebuildResult:
    () => void;

  clearClosedResult:
    () => void;

  clearDeletedResult:
    () => void;
}

const initialState:
  AvailabilityPeriodsState = {
    periods: [],

    isLoading: true,
    isCreating: false,
    isImportingSpecialDays: false,

    rebuildingPeriodId: null,
    openingPeriodId: null,
    closingPeriodId: null,
    reopeningPeriodId: null,
    deletingPeriodId: null,

    error: null,

    lastCreatedResult: null,
    lastImportResult: null,
    lastRebuildResult: null,
    lastOpenedResult: null,
    lastClosedResult: null,
    lastReopenedResult: null,
    lastDeletedResult: null,
  };

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה בניהול תקופות האילוצים.';
}

export function useAvailabilityPeriods():
  UseAvailabilityPeriodsResult {
  const [
    state,
    setState,
  ] =
    useState<AvailabilityPeriodsState>(
      initialState,
    );

  const loadPeriods =
    useCallback(
      async (): Promise<void> => {
        setState(
          (currentState) => ({
            ...currentState,
            isLoading: true,
            error: null,
          }),
        );

        try {
          const periods =
            await availabilityService
              .getAvailabilityPeriods();

          setState(
            (currentState) => ({
              ...currentState,
              periods,
              isLoading: false,
              error: null,
            }),
          );
        } catch (error) {
          setState(
            (currentState) => ({
              ...currentState,
              isLoading: false,
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

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  const createPeriod =
    useCallback(
      async (
        input:
          CreateAvailabilityPeriodInput,
      ): Promise<CreateAvailabilityPeriodResult> => {
        setState(
          (currentState) => ({
            ...currentState,
            isCreating: true,
            error: null,
            lastCreatedResult: null,
          }),
        );

        try {
          const result =
            await availabilityService
              .createAvailabilityPeriod(
                input,
              );

          const periods =
            await availabilityService
              .getAvailabilityPeriods();

          setState(
            (currentState) => ({
              ...currentState,
              periods,
              isLoading: false,
              isCreating: false,
              error: null,
              lastCreatedResult:
                result,
            }),
          );

          return result;
        } catch (error) {
          const errorMessage =
            getErrorMessage(error);

          setState(
            (currentState) => ({
              ...currentState,
              isCreating: false,
              error: errorMessage,
            }),
          );

          throw error;
        }
      },
      [],
    );

  const importSpecialDays =
    useCallback(
      async (
        year: number,
      ): Promise<ImportSpecialDaysResult> => {
        setState(
          (currentState) => ({
            ...currentState,
            isImportingSpecialDays:
              true,
            error: null,
            lastImportResult: null,
          }),
        );

        try {
          const result =
            await availabilityService
              .importCalendarSpecialDays(
                year,
              );

          setState(
            (currentState) => ({
              ...currentState,
              isImportingSpecialDays:
                false,
              error: null,
              lastImportResult:
                result,
            }),
          );

          return result;
        } catch (error) {
          const errorMessage =
            getErrorMessage(error);

          setState(
            (currentState) => ({
              ...currentState,
              isImportingSpecialDays:
                false,
              error: errorMessage,
            }),
          );

          throw error;
        }
      },
      [],
    );

  const rebuildPeriodSlots =
    useCallback(
      async (
        periodId: string,
      ): Promise<RebuildAvailabilityPeriodResult> => {
        setState(
          (currentState) => ({
            ...currentState,
            rebuildingPeriodId:
              periodId,
            error: null,
            lastRebuildResult:
              null,
          }),
        );

        try {
          const result =
            await availabilityService
              .rebuildAvailabilityPeriodSlots(
                periodId,
              );

          const periods =
            await availabilityService
              .getAvailabilityPeriods();

          setState(
            (currentState) => ({
              ...currentState,
              periods,
              rebuildingPeriodId:
                null,
              error: null,
              lastRebuildResult:
                result,
            }),
          );

          return result;
        } catch (error) {
          const errorMessage =
            getErrorMessage(error);

          setState(
            (currentState) => ({
              ...currentState,
              rebuildingPeriodId:
                null,
              error: errorMessage,
            }),
          );

          throw error;
        }
      },
      [],
    );

  const openPeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<OpenAvailabilityPeriodResult> => {
        setState(
          (currentState) => ({
            ...currentState,
            openingPeriodId:
              periodId,
            error: null,
            lastOpenedResult:
              null,
          }),
        );

        try {
          const result =
            await availabilityService
              .openAvailabilityPeriod(
                periodId,
              );

          const periods =
            await availabilityService
              .getAvailabilityPeriods();

          setState(
            (currentState) => ({
              ...currentState,
              periods,
              openingPeriodId:
                null,
              error: null,
              lastOpenedResult:
                result,
            }),
          );

          return result;
        } catch (error) {
          const errorMessage =
            getErrorMessage(error);

          setState(
            (currentState) => ({
              ...currentState,
              openingPeriodId:
                null,
              error: errorMessage,
            }),
          );

          throw error;
        }
      },
      [],
    );

  const closePeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<CloseAvailabilityPeriodResult> => {
        setState(
          (currentState) => ({
            ...currentState,
            closingPeriodId:
              periodId,
            error: null,
            lastClosedResult:
              null,
          }),
        );

        try {
          const result =
            await availabilityService
              .closeAvailabilityPeriod(
                periodId,
              );

          const periods =
            await availabilityService
              .getAvailabilityPeriods();

          setState(
            (currentState) => ({
              ...currentState,
              periods,
              closingPeriodId:
                null,
              error: null,
              lastClosedResult:
                result,
            }),
          );

          return result;
        } catch (error) {
          const errorMessage =
            getErrorMessage(error);

          setState(
            (currentState) => ({
              ...currentState,
              closingPeriodId:
                null,
              error: errorMessage,
            }),
          );

          throw error;
        }
      },
      [],
    );

  const reopenPeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<ReopenAvailabilityPeriodResult> => {
        setState(
          (currentState) => ({
            ...currentState,
            reopeningPeriodId:
              periodId,
            error:
              null,
            lastReopenedResult:
              null,
          }),
        );

        try {
          const result =
            await availabilityService
              .reopenAvailabilityPeriod(
                periodId,
              );

          const periods =
            await availabilityService
              .getAvailabilityPeriods();

          setState(
            (currentState) => ({
              ...currentState,
              periods,
              reopeningPeriodId:
                null,
              lastReopenedResult:
                result,
            }),
          );

          return result;
        } catch (error) {
          setState(
            (currentState) => ({
              ...currentState,
              reopeningPeriodId:
                null,
              error:
                getErrorMessage(
                  error,
                ),
            }),
          );

          throw error;
        }
      },
      [],
    );

  const deletePeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<DeleteAvailabilityPeriodResult> => {
        const normalizedPeriodId =
          periodId.trim();

        if (!normalizedPeriodId) {
          throw new Error(
            'לא התקבל מזהה תקופת אילוצים תקין.',
          );
        }

        setState(
          (currentState) => ({
            ...currentState,
            deletingPeriodId:
              normalizedPeriodId,
            error: null,
            lastDeletedResult:
              null,
          }),
        );

        try {
          const result =
            await availabilityService
              .deleteAvailabilityPeriod(
                normalizedPeriodId,
              );

          const periods =
            await availabilityService
              .getAvailabilityPeriods();

          setState(
            (currentState) => ({
              ...currentState,
              periods,
              deletingPeriodId:
                null,
              error: null,
              lastDeletedResult:
                result,
            }),
          );

          return result;
        } catch (error) {
          const errorMessage =
            getErrorMessage(error);

          setState(
            (currentState) => ({
              ...currentState,
              deletingPeriodId:
                null,
              error: errorMessage,
            }),
          );

          throw error;
        }
      },
      [],
    );

  const clearError =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,
          error: null,
        }),
      );
    }, []);

  const clearCreatedResult =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,
          lastCreatedResult:
            null,
        }),
      );
    }, []);

  const clearImportResult =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,
          lastImportResult:
            null,
        }),
      );
    }, []);

  const clearRebuildResult =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,
          lastRebuildResult:
            null,
        }),
      );
    }, []);

  const clearClosedResult =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,
          lastClosedResult:
            null,
        }),
      );
    }, []);

  const clearDeletedResult =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,
          lastDeletedResult:
            null,
        }),
      );
    }, []);

  return {
    state,
    loadPeriods,
    createPeriod,
    importSpecialDays,
    rebuildPeriodSlots,
    openPeriod,
    closePeriod,
    reopenPeriod,
    deletePeriod,
    clearError,
    clearCreatedResult,
    clearImportResult,
    clearRebuildResult,
    clearClosedResult,
    clearDeletedResult,
  };
}