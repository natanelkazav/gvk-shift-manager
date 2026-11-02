/**
 * קובץ: src/hooks/useAvailabilityPeriods.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור תקופות אילוצים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityPeriodsState, UseAvailabilityPeriodsResult, getErrorMessage, useAvailabilityPeriods.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
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

/**
 * חוזה הנתונים AvailabilityPeriodsState: תקופות אילוצים.
 */
interface AvailabilityPeriodsState {
  // periods — תקופות.
  periods: AvailabilityPeriod[];

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;
  isCreating: boolean;
  // isImportingSpecialDays — ימים.
  isImportingSpecialDays: boolean;

  // rebuildingPeriodId — מזהה התקופה.
  rebuildingPeriodId: string | null;
  // openingPeriodId — מזהה התקופה.
  openingPeriodId: string | null;
  // closingPeriodId — מזהה התקופה.
  closingPeriodId: string | null;
  // reopeningPeriodId — מזהה התקופה.
  reopeningPeriodId: string | null;
  // deletingPeriodId — מזהה התקופה.
  deletingPeriodId: string | null;

  // error — שגיאה.
  error: string | null;

  // lastCreatedResult — תוצאה.
  lastCreatedResult:
    CreateAvailabilityPeriodResult | null;

  // lastImportResult — ייבוא / תוצאה.
  lastImportResult:
    ImportSpecialDaysResult | null;

  // lastRebuildResult — תוצאה.
  lastRebuildResult:
    RebuildAvailabilityPeriodResult | null;

  // lastOpenedResult — תוצאה.
  lastOpenedResult:
    OpenAvailabilityPeriodResult | null;

  // lastClosedResult — תוצאה.
  lastClosedResult:
    CloseAvailabilityPeriodResult | null;

  // lastReopenedResult — תוצאה.
  lastReopenedResult:
    ReopenAvailabilityPeriodResult | null;

  // lastDeletedResult — תוצאה.
  lastDeletedResult:
    DeleteAvailabilityPeriodResult | null;
}

/**
 * חוזה הנתונים UseAvailabilityPeriodsResult: תקופות אילוצים.
 */
interface UseAvailabilityPeriodsResult {
  // state — מצב.
  state: AvailabilityPeriodsState;

  // loadPeriods — תקופות.
  loadPeriods:
    () => Promise<void>;

  // createPeriod — תקופה.
  createPeriod: (
    input: CreateAvailabilityPeriodInput,
  ) => Promise<CreateAvailabilityPeriodResult>;

  // importSpecialDays — ייבוא / ימים.
  importSpecialDays: (
    year: number,
  ) => Promise<ImportSpecialDaysResult>;

  // rebuildPeriodSlots — תקופה.
  rebuildPeriodSlots: (
    periodId: string,
  ) => Promise<RebuildAvailabilityPeriodResult>;

  // openPeriod — תקופה.
  openPeriod: (
    periodId: string,
  ) => Promise<OpenAvailabilityPeriodResult>;

  // closePeriod — תקופה.
  closePeriod: (
    periodId: string,
  ) => Promise<CloseAvailabilityPeriodResult>;

  // reopenPeriod — תקופה.
  reopenPeriod: (
    periodId: string,
  ) => Promise<ReopenAvailabilityPeriodResult>;

  // deletePeriod — תקופה.
  deletePeriod: (
    periodId: string,
  ) => Promise<DeleteAvailabilityPeriodResult>;

  // clearError — שגיאה.
  clearError:
    () => void;

  // clearCreatedResult — תוצאה.
  clearCreatedResult:
    () => void;

  // clearImportResult — ייבוא / תוצאה.
  clearImportResult:
    () => void;

  // clearRebuildResult — תוצאה.
  clearRebuildResult:
    () => void;

  // clearClosedResult — תוצאה.
  clearClosedResult:
    () => void;

  // clearDeletedResult — תוצאה.
  clearDeletedResult:
    () => void;
}

// initialState — מצב.
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

  return 'אירעה שגיאה בלתי צפויה בניהול תקופות האילוצים.';
}

/**
 * פעולה useAvailabilityPeriods: חיבור מצב או הקשר עבור תקופות אילוצים.
 * @returns UseAvailabilityPeriodsResult — הפלט בהתאם לחתימה.
 */
export function useAvailabilityPeriods():
  UseAvailabilityPeriodsResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<AvailabilityPeriodsState>(
      initialState,
    );

  // loadPeriods — תקופות.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // periods — תקופות.
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

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [loadPeriods].
  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  // createPeriod — תקופה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await availabilityService
              .createAvailabilityPeriod(
                input,
              );

          // periods — תקופות.
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
          // errorMessage — הודעת שגיאה.
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

  // importSpecialDays — ייבוא / ימים.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
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
          // errorMessage — הודעת שגיאה.
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

  // rebuildPeriodSlots — תקופה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await availabilityService
              .rebuildAvailabilityPeriodSlots(
                periodId,
              );

          // periods — תקופות.
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
          // errorMessage — הודעת שגיאה.
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

  // openPeriod — תקופה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await availabilityService
              .openAvailabilityPeriod(
                periodId,
              );

          // periods — תקופות.
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
          // errorMessage — הודעת שגיאה.
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

  // closePeriod — תקופה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await availabilityService
              .closeAvailabilityPeriod(
                periodId,
              );

          // periods — תקופות.
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
          // errorMessage — הודעת שגיאה.
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

  // reopenPeriod — תקופה.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await availabilityService
              .reopenAvailabilityPeriod(
                periodId,
              );

          // periods — תקופות.
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

  // deletePeriod — תקופה.
  const deletePeriod =
    useCallback(
      async (
        periodId: string,
      ): Promise<DeleteAvailabilityPeriodResult> => {
        // normalizedPeriodId — מזהה התקופה.
        const normalizedPeriodId =
          periodId.trim();

        // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await availabilityService
              .deleteAvailabilityPeriod(
                normalizedPeriodId,
              );

          // periods — תקופות.
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
          // errorMessage — הודעת שגיאה.
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

  // clearError — שגיאה.
  const clearError =
    useCallback((): void => {
      setState(
        (currentState) => ({
          ...currentState,
          error: null,
        }),
      );
    }, []);

  // clearCreatedResult — תוצאה.
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

  // clearImportResult — ייבוא / תוצאה.
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

  // clearRebuildResult — תוצאה.
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

  // clearClosedResult — תוצאה.
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

  // clearDeletedResult — תוצאה.
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