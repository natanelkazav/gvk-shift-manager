import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { availabilityService } from '../services/availabilityService';
import type {
  AvailabilityPeriod,
  CreateAvailabilityPeriodInput,
  CreateAvailabilityPeriodResult,
  ImportSpecialDaysResult,
  OpenAvailabilityPeriodResult,
  CloseAvailabilityPeriodResult,
  RebuildAvailabilityPeriodResult,
} from '../types/availability';

interface AvailabilityPeriodsState {
  periods: AvailabilityPeriod[];

  isLoading: boolean;
  isCreating: boolean;
  isImportingSpecialDays: boolean;

  rebuildingPeriodId:
    string | null;

  error: string | null;
  closingPeriodId:
  string | null;

lastClosedResult:
  CloseAvailabilityPeriodResult | null;
  lastCreatedResult:
    CreateAvailabilityPeriodResult | null;

  lastImportResult:
    ImportSpecialDaysResult | null;

  lastRebuildResult:
  RebuildAvailabilityPeriodResult | null;
    openingPeriodId: string | null;

lastOpenedResult:
  OpenAvailabilityPeriodResult | null;
}

interface UseAvailabilityPeriodsResult {
  state: AvailabilityPeriodsState;

  loadPeriods: () => Promise<void>;

  createPeriod: (
    input: CreateAvailabilityPeriodInput,
  ) => Promise<CreateAvailabilityPeriodResult>;

  importSpecialDays: (
    year: number,
  ) => Promise<ImportSpecialDaysResult>;

  rebuildPeriodSlots: (
    periodId: string,
  ) => Promise<RebuildAvailabilityPeriodResult>;

  clearError: () => void;

  clearCreatedResult: () => void;

  clearImportResult: () => void;

  clearRebuildResult: () => void;
  openPeriod: (
  periodId: string,
) => Promise<OpenAvailabilityPeriodResult>;
closePeriod: (
  periodId: string,
) => Promise<CloseAvailabilityPeriodResult>;

clearClosedResult:
  () => void;
}

const initialState:
  AvailabilityPeriodsState = {
    periods: [],
    isLoading: true,
    isCreating: false,
    isImportingSpecialDays: false,
    rebuildingPeriodId: null,
    error: null,
    lastCreatedResult: null,
    lastImportResult: null,
    lastRebuildResult: null,
    closingPeriodId: null,
    lastClosedResult: null,
    openingPeriodId: null,
lastOpenedResult: null,
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
                getErrorMessage(error),
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
          lastCreatedResult: null,
        }),
      );
    }, []);

  const clearImportResult =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,
          lastImportResult: null,
        }),
      );
    }, []);
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

            error:
              errorMessage,
          }),
        );

        throw error;
      }
    },
    [],
  );
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
  const clearRebuildResult =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,
          lastRebuildResult: null,
        }),
      );
    }, []);
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

            error:
              errorMessage,
          }),
        );

        throw error;
      }
    },
    [],
  );
return {
  state,
  loadPeriods,
  createPeriod,
  importSpecialDays,
  rebuildPeriodSlots,
  openPeriod,
  closePeriod,
  clearError,
  clearCreatedResult,
  clearImportResult,
  clearRebuildResult,
  clearClosedResult,
};
  
}
