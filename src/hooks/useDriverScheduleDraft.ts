/**
 * קובץ: src/hooks/useDriverScheduleDraft.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור כוננים / שיבוץ / טיוטה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: DriverScheduleDraftState, UseDriverScheduleDraftResult, normalizeDriverScheduleDraftError, useDriverScheduleDraft.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useState,
} from 'react';

import {
  driverScheduleService,
} from '../services/driverScheduleService';

import type {
  CreateDriverScheduleDraftResponse,
  DriverScheduleData,
  UpdateDriverScheduleDayRequest,
  UpdateDriverScheduleDayResponse,
  PublishDriverScheduleResponse,
  TransferMyDriverDutyRequest,
  TransferMyDriverDutyResponse,
} from '../types/driverSchedule';

/**
 * חוזה הנתונים DriverScheduleDraftState: כוננים / שיבוץ / טיוטה / מצב.
 */
interface DriverScheduleDraftState {
  // data — נתונים.
  data:
    DriverScheduleData | null;

  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;

  isCreating: boolean;

  // updatingDayId — מזהה היום.
  updatingDayId:
    string | null;

  // transferringDayId — מזהה היום.
  transferringDayId:
    string | null;

  // error — שגיאה.
  error:
    string | null;

  // lastCreatedResult — תוצאה.
  lastCreatedResult:
    CreateDriverScheduleDraftResponse | null;

  // lastUpdatedDayResult — יום / תוצאה.
  lastUpdatedDayResult:
    UpdateDriverScheduleDayResponse | null;

  // lastTransferredDutyResult — תוצאה.
  lastTransferredDutyResult:
    TransferMyDriverDutyResponse | null;

    isPublishing: boolean;

  // lastPublishedResult — פורסם / תוצאה.
  lastPublishedResult:
  PublishDriverScheduleResponse | null;
}

/**
 * חוזה הנתונים UseDriverScheduleDraftResult: כוננים / שיבוץ / טיוטה / תוצאה.
 */
interface UseDriverScheduleDraftResult {
  // state — מצב.
  state:
    DriverScheduleDraftState;

  // loadLatestSchedule — שיבוץ.
  loadLatestSchedule:
    () => Promise<DriverScheduleData | null>;

  // loadScheduleById — שיבוץ / מזהה.
  loadScheduleById: (
    schedulePeriodId: string,
  ) => Promise<DriverScheduleData | null>;

  // loadScheduleByMonth — שיבוץ / חודש.
  loadScheduleByMonth: (
    year: number,
    month: number,
  ) => Promise<DriverScheduleData | null>;

  // createDraft — טיוטה.
  createDraft: (
    availabilityPeriodId: string,
  ) => Promise<CreateDriverScheduleDraftResponse>;

  // updateScheduleDay — שיבוץ / יום.
  updateScheduleDay: (
    request:
      UpdateDriverScheduleDayRequest,
  ) => Promise<UpdateDriverScheduleDayResponse>;

  transferMyDuty: (
    request:
      TransferMyDriverDutyRequest,
  ) => Promise<TransferMyDriverDutyResponse>;

  // clearError — שגיאה.
  clearError:
    () => void;

  // clearLastUpdatedDayResult — יום / תוצאה.
  clearLastUpdatedDayResult:
    () => void;

  reset:
    () => void;
  // publishSchedule — שיבוץ.
  publishSchedule:
  () => Promise<PublishDriverScheduleResponse>;
}

// initialState — מצב.
const initialState:
  DriverScheduleDraftState = {
    data: null,

    isLoading: false,

    isCreating: false,

    updatingDayId:
      null,

    transferringDayId:
      null,

    error: null,

    lastCreatedResult:
      null,

    lastUpdatedDayResult:
      null,

    lastTransferredDutyResult:
      null,

    isPublishing: false,

lastPublishedResult: null,
  };

/**
 * פעולה normalizeDriverScheduleDraftError: נרמול כוננים / שיבוץ / טיוטה / שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeDriverScheduleDraftError(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    // normalizedMessage — הודעה.
    const normalizedMessage =
      error.message
        .trim()
        .toLowerCase();

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'not authenticated', ).
    if (
      normalizedMessage.includes(
        'not authenticated',
      )
    ) {
      return 'לא נמצאה התחברות פעילה. יש להתחבר מחדש.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'user not active', ).
    if (
      normalizedMessage.includes(
        'user not active',
      )
    ) {
      return 'המשתמש אינו פעיל.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'not allowed', ).
    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      return 'אין לך הרשאה לצפות או לערוך את לוח הכוננים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability period id is required', ).
    if (
      normalizedMessage.includes(
        'driver availability period id is required',
      )
    ) {
      return 'מזהה חודש אילוצי הכוננים חסר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver schedule period id is required', ).
    if (
      normalizedMessage.includes(
        'driver schedule period id is required',
      )
    ) {
      return 'מזהה תקופת לוח הכוננים חסר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver schedule day id is required', ).
    if (
      normalizedMessage.includes(
        'driver schedule day id is required',
      )
    ) {
      return 'מזהה יום השיבוץ חסר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability period not found', ).
    if (
      normalizedMessage.includes(
        'driver availability period not found',
      )
    ) {
      return 'חודש אילוצי הכוננים לא נמצא.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver schedule day not found', ).
    if (
      normalizedMessage.includes(
        'driver schedule day not found',
      )
    ) {
      return 'יום השיבוץ לא נמצא.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver schedule period not found', ).
    if (
      normalizedMessage.includes(
        'driver schedule period not found',
      )
    ) {
      return 'תקופת לוח הכוננים לא נמצאה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability period must be closed before scheduling', ).
    if (
      normalizedMessage.includes(
        'driver availability period must be closed before scheduling',
      )
    ) {
      return 'יש לסגור את חודש האילוצים לפני יצירת השיבוץ.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only draft driver schedules can be edited', ).
    if (
      normalizedMessage.includes(
        'only draft driver schedules can be edited',
      )
    ) {
      return 'ניתן לערוך רק לוח כוננים שנמצא במצב טיוטה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'selected on-call driver was not found or is inactive', ).
    if (
      normalizedMessage.includes(
        'selected on-call driver was not found or is inactive',
      )
    ) {
      return 'הכונן שנבחר לא נמצא או שאינו פעיל.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver cannot be assigned on consecutive days', ).
    if (
      normalizedMessage.includes(
        'driver cannot be assigned on consecutive days',
      )
    ) {
      return 'לא ניתן לשבץ את אותו כונן ביומיים רצופים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver schedule period already exists for this availability period', ) || normalizedMessage.includes( 'driver s.
    if (
      normalizedMessage.includes(
        'driver schedule period already exists for this availability period',
      ) ||
      normalizedMessage.includes(
        'driver schedule period already exists for this month',
      )
    ) {
      return 'כבר קיימת טיוטת לוח כוננים עבור החודש הזה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'no active on-call drivers were found', ).
    if (
      normalizedMessage.includes(
        'no active on-call drivers were found',
      )
    ) {
      return 'לא נמצאו כוננים פעילים במערכת.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver availability period has no days', ).
    if (
      normalizedMessage.includes(
        'driver availability period has no days',
      )
    ) {
      return 'לא נמצאו ימים בחודש האילוצים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver schedule month is invalid', ).
    if (
      normalizedMessage.includes(
        'driver schedule month is invalid',
      )
    ) {
      return 'חודש לוח הכוננים אינו תקין.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver schedule year is invalid', ).
    if (
      normalizedMessage.includes(
        'driver schedule year is invalid',
      )
    ) {
      return 'שנת לוח הכוננים אינה תקינה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת יצירת טיוטת לוח הכוננים', ).
    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת יצירת טיוטת לוח הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת יצירת טיוטת לוח הכוננים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת עדכון יום בלוח הכוננים', ).
    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת עדכון יום בלוח הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת עדכון יום בלוח הכוננים.';
    }
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only published current or next month driver schedules can be edited', ).
    if (
      normalizedMessage.includes(
        'only published current or next month driver schedules can be edited',
      )
    ) {
      return 'ניתן לערוך כל כוננות רק בלוח שפורסם של החודש הנוכחי או החודש הבא.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only current or next month driver schedule can be edited', ).
    if (
      normalizedMessage.includes(
        'only current or next month driver schedule can be edited',
      )
    ) {
      return 'ניתן לערוך כל כוננות רק בחודש הנוכחי או בחודש הבא.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'active on-call driver profile not found', ).
    if (
      normalizedMessage.includes(
        'active on-call driver profile not found',
      )
    ) {
      return 'לא נמצא פרופיל כונן פעיל עבור המשתמש המחובר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'new on-call driver id is required', ).
    if (
      normalizedMessage.includes(
        'new on-call driver id is required',
      )
    ) {
      return 'יש לבחור כונן מחליף.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'new on-call driver must be different', ).
    if (
      normalizedMessage.includes(
        'new on-call driver must be different',
      )
    ) {
      return 'יש לבחור כונן אחר.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only published driver schedules can be changed by drivers', ).
    if (
      normalizedMessage.includes(
        'only published driver schedules can be changed by drivers',
      )
    ) {
      return 'ניתן להעביר כוננות רק מלוח כוננים שפורסם.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'drivers can change duties only in the current or next month', ) || normalizedMessage.includes( 'drivers can cha.
    if (
      normalizedMessage.includes(
        'drivers can change duties only in the current or next month',
      ) ||
      normalizedMessage.includes(
        'drivers can change duties only in the current month',
      )
    ) {
      return 'ניתן לשנות כוננות רק בחודש הנוכחי או בחודש הבא לאחר פרסום הלוח.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'past driver duties cannot be changed', ).
    if (
      normalizedMessage.includes(
        'past driver duties cannot be changed',
      )
    ) {
      return 'לא ניתן לשנות כוננות שכבר הסתיימה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver can transfer only their own duty', ).
    if (
      normalizedMessage.includes(
        'driver can transfer only their own duty',
      )
    ) {
      return 'ניתן להעביר רק כוננות שמשובצת כרגע אליך.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'locked driver duty cannot be changed', ).
    if (
      normalizedMessage.includes(
        'locked driver duty cannot be changed',
      )
    ) {
      return 'הכוננות נעולה ולא ניתן לשנות אותה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת העברת הכוננות', ).
    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת העברת הכוננות',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת העברת הכוננות.';
    }
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'only draft driver schedules can be published', ).
    if (
      normalizedMessage.includes(
        'only draft driver schedules can be published',
      )
    ) {
      return 'ניתן לפרסם רק לוח כוננים שנמצא במצב טיוטה.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver schedule has no days', ).
    if (
      normalizedMessage.includes(
        'driver schedule has no days',
      )
    ) {
      return 'לא קיימים ימים בלוח הכוננים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'all driver schedule days must be assigned before publishing', ).
    if (
      normalizedMessage.includes(
        'all driver schedule days must be assigned before publishing',
      )
    ) {
      return 'יש לשבץ כונן בכל ימי החודש לפני הפרסום.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'driver schedule contains consecutive-day assignments', ).
    if (
      normalizedMessage.includes(
        'driver schedule contains consecutive-day assignments',
      )
    ) {
      return 'לא ניתן לפרסם לוח שמכיל אותו כונן ביומיים רצופים.';
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedMessage.includes( 'לא התקבלה תשובה בעת פרסום לוח הכוננים', ).
    if (
      normalizedMessage.includes(
        'לא התקבלה תשובה בעת פרסום לוח הכוננים',
      )
    ) {
      return 'לא התקבלה תשובה תקינה בעת פרסום לוח הכוננים.';
    }

    return error.message;
  }

  return 'לא ניתן היה לבצע את הפעולה בלוח הכוננים.';
}

/**
 * פעולה useDriverScheduleDraft: חיבור מצב או הקשר עבור כוננים / שיבוץ / טיוטה.
 * @returns UseDriverScheduleDraftResult — הפלט בהתאם לחתימה.
 */
export function useDriverScheduleDraft():
  UseDriverScheduleDraftResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<DriverScheduleDraftState>(
      initialState,
    );

  // loadLatestSchedule — שיבוץ.
  const loadLatestSchedule =
    useCallback(
      async (): Promise<DriverScheduleData | null> => {
        setState(
          (currentState) => ({
            ...currentState,

            isLoading:
              true,

            error:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // data — נתונים.
          const data =
            await driverScheduleService
              .getLatestSchedule();

          setState(
            (currentState) => ({
              ...currentState,

              data,

              isLoading:
                false,

              error:
                null,
            }),
          );

          return data;
        } catch (error) {
          // normalizedError — שגיאה.
          const normalizedError =
            normalizeDriverScheduleDraftError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              data:
                null,

              isLoading:
                false,

              error:
                normalizedError,
            }),
          );

          throw error;
        }
      },
      [],
    );
// publishSchedule — שיבוץ.
const publishSchedule =
  useCallback(
    async (): Promise<PublishDriverScheduleResponse> => {
      // schedulePeriodId — תקופת שיבוץ.
      const schedulePeriodId =
        state.data
          ?.period
          ?.id ??
        null;

      // עצירת הפעולה עם שגיאה כאשר !schedulePeriodId.
      if (!schedulePeriodId) {
        // missingPeriodError — תקופה / שגיאה.
        const missingPeriodError =
          new Error(
            'Driver schedule period id is required.',
          );

        setState(
          (currentState) => ({
            ...currentState,

            error:
              normalizeDriverScheduleDraftError(
                missingPeriodError,
              ),
          }),
        );

        throw missingPeriodError;
      }

    // עצירת הפעולה עם שגיאה כאשר ( state.data ?.statistics ?.unassignedDays ?? 0 ) > 0.
    if (
      (
        state.data
          ?.statistics
          ?.unassignedDays ??
        0
      ) > 0
    )
 {
        // unassignedDaysError — ימים / שגיאה.
        const unassignedDaysError =
          new Error(
            'All driver schedule days must be assigned before publishing.',
          );

        setState(
          (currentState) => ({
            ...currentState,

            error:
              'יש לשבץ כונן בכל ימי החודש לפני הפרסום.',
          }),
        );

        throw unassignedDaysError;
      }

      setState(
        (currentState) => ({
          ...currentState,

          isPublishing:
            true,

          error:
            null,

          lastPublishedResult:
            null,
        }),
      );

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // result — תוצאה.
        const result =
          await driverScheduleService
            .publishSchedule(
              schedulePeriodId,
            );

        // refreshedData — נתונים.
        const refreshedData =
          await driverScheduleService
            .getScheduleById(
              schedulePeriodId,
            );

        setState(
          (currentState) => ({
            ...currentState,

            data:
              refreshedData,

            isPublishing:
              false,

            error:
              null,

            lastPublishedResult:
              result,
          }),
        );

        return result;
      } catch (error) {
        // normalizedError — שגיאה.
        const normalizedError =
          normalizeDriverScheduleDraftError(
            error,
          );

        setState(
          (currentState) => ({
            ...currentState,

            isPublishing:
              false,

            error:
              normalizedError,

            lastPublishedResult:
              null,
          }),
        );

        throw error;
      }
    },
    [
      state.data,
    ],
  );
  // loadScheduleById — שיבוץ / מזהה.
  const loadScheduleById =
    useCallback(
      async (
        schedulePeriodId: string,
      ): Promise<DriverScheduleData | null> => {
        // normalizedSchedulePeriodId — תקופת שיבוץ.
        const normalizedSchedulePeriodId =
          schedulePeriodId.trim();

        // עצירת הפעולה עם שגיאה כאשר !normalizedSchedulePeriodId.
        if (
          !normalizedSchedulePeriodId
        ) {
          // missingPeriodError — תקופה / שגיאה.
          const missingPeriodError =
            new Error(
              'Driver schedule period id is required.',
            );

          setState(
            (currentState) => ({
              ...currentState,

              error:
                normalizeDriverScheduleDraftError(
                  missingPeriodError,
                ),
            }),
          );

          throw missingPeriodError;
        }

        setState(
          (currentState) => ({
            ...currentState,

            isLoading:
              true,

            error:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // data — נתונים.
          const data =
            await driverScheduleService
              .getScheduleById(
                normalizedSchedulePeriodId,
              );

          setState(
            (currentState) => ({
              ...currentState,

              data,

              isLoading:
                false,

              error:
                null,
            }),
          );

          return data;
        } catch (error) {
          // normalizedError — שגיאה.
          const normalizedError =
            normalizeDriverScheduleDraftError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              data:
                null,

              isLoading:
                false,

              error:
                normalizedError,
            }),
          );

          throw error;
        }
      },
      [],
    );

  // loadScheduleByMonth — שיבוץ / חודש.
  const loadScheduleByMonth =
    useCallback(
      async (
        year: number,
        month: number,
      ): Promise<DriverScheduleData | null> => {
        setState(
          (currentState) => ({
            ...currentState,

            isLoading:
              true,

            error:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // data — נתונים.
          const data =
            await driverScheduleService
              .getScheduleByMonth(
                year,
                month,
              );

          setState(
            (currentState) => ({
              ...currentState,

              data,

              isLoading:
                false,

              error:
                null,
            }),
          );

          return data;
        } catch (error) {
          // normalizedError — שגיאה.
          const normalizedError =
            normalizeDriverScheduleDraftError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              data:
                null,

              isLoading:
                false,

              error:
                normalizedError,
            }),
          );

          throw error;
        }
      },
      [],
    );

  // createDraft — טיוטה.
  const createDraft =
    useCallback(
      async (
        availabilityPeriodId: string,
      ): Promise<CreateDriverScheduleDraftResponse> => {
        // normalizedAvailabilityPeriodId — תקופת אילוצים.
        const normalizedAvailabilityPeriodId =
          availabilityPeriodId.trim();

        // עצירת הפעולה עם שגיאה כאשר !normalizedAvailabilityPeriodId.
        if (
          !normalizedAvailabilityPeriodId
        ) {
          // missingPeriodError — תקופה / שגיאה.
          const missingPeriodError =
            new Error(
              'Driver availability period id is required.',
            );

          setState(
            (currentState) => ({
              ...currentState,

              error:
                normalizeDriverScheduleDraftError(
                  missingPeriodError,
                ),
            }),
          );

          throw missingPeriodError;
        }

        setState(
          (currentState) => ({
            ...currentState,

            isCreating:
              true,

            error:
              null,

            lastCreatedResult:
              null,

            lastUpdatedDayResult:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await driverScheduleService
              .createDraft(
                normalizedAvailabilityPeriodId,
              );

          // data — נתונים.
          const data =
            await driverScheduleService
              .getScheduleById(
                result.schedulePeriodId,
              );

          setState(
            (currentState) => ({
              ...currentState,

              data,

              isCreating:
                false,

              isLoading:
                false,

              error:
                null,

              lastCreatedResult:
                result,

              lastUpdatedDayResult:
                null,
            }),
          );

          return result;
        } catch (error) {
          // normalizedError — שגיאה.
          const normalizedError =
            normalizeDriverScheduleDraftError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              isCreating:
                false,

              error:
                normalizedError,

              lastCreatedResult:
                null,
            }),
          );

          throw error;
        }
      },
      [],
    );

  // currentSchedulePeriodId — תקופת שיבוץ הנוכחי.
  const currentSchedulePeriodId =
    state.data?.period?.id ??
    null;

  // currentSchedulePeriodStatus — תקופת שיבוץ הנוכחי.
  const currentSchedulePeriodStatus =
    state.data?.period?.status ??
    null;

  // updateScheduleDay — שיבוץ / יום.
  const updateScheduleDay =
    useCallback(
      async (
        request:
          UpdateDriverScheduleDayRequest,
      ): Promise<UpdateDriverScheduleDayResponse> => {
        // normalizedScheduleDayId — מזהה היום.
        const normalizedScheduleDayId =
          request.scheduleDayId.trim();

        // עצירת הפעולה עם שגיאה כאשר !normalizedScheduleDayId.
        if (
          !normalizedScheduleDayId
        ) {
          // missingDayError — יום / שגיאה.
          const missingDayError =
            new Error(
              'Driver schedule day id is required.',
            );

          setState(
            (currentState) => ({
              ...currentState,

              error:
                normalizeDriverScheduleDraftError(
                  missingDayError,
                ),
            }),
          );

          throw missingDayError;
        }

        // עצירת הפעולה עם שגיאה כאשר !currentSchedulePeriodId.
        if (!currentSchedulePeriodId) {
          // missingPeriodError — תקופה / שגיאה.
          const missingPeriodError =
            new Error(
              'Driver schedule period id is required.',
            );

          setState(
            (currentState) => ({
              ...currentState,

              error:
                normalizeDriverScheduleDraftError(
                  missingPeriodError,
                ),
            }),
          );

          throw missingPeriodError;
        }

        setState(
          (currentState) => ({
            ...currentState,

            updatingDayId:
              normalizedScheduleDayId,

            error:
              null,

            lastUpdatedDayResult:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // updateRequest — נתוני הבקשה.
          const updateRequest = {
            ...request,

            scheduleDayId:
              normalizedScheduleDayId,
          };

          // result — תוצאה.
          const result =
            currentSchedulePeriodStatus ===
              'published'
              ? await driverScheduleService
                  .updatePublishedScheduleDay(
                    updateRequest,
                  )
              : await driverScheduleService
                  .updateScheduleDay(
                    updateRequest,
                  );

          // refreshedData — נתונים.
          const refreshedData =
            await driverScheduleService
              .getScheduleById(
                currentSchedulePeriodId,
              );

          setState(
            (currentState) => ({
              ...currentState,

              data:
                refreshedData,

              updatingDayId:
                null,

              error:
                null,

              lastUpdatedDayResult:
                result,
            }),
          );

          return result;
        } catch (error) {
          // normalizedError — שגיאה.
          const normalizedError =
            normalizeDriverScheduleDraftError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              updatingDayId:
                null,

              error:
                normalizedError,

              lastUpdatedDayResult:
                null,
            }),
          );

          throw error;
        }
      },
      [
        currentSchedulePeriodId,
        currentSchedulePeriodStatus,
      ],
    );


  const transferMyDuty =
    useCallback(
      async (
        request:
          TransferMyDriverDutyRequest,
      ): Promise<TransferMyDriverDutyResponse> => {
        // normalizedScheduleDayId — מזהה היום.
        const normalizedScheduleDayId =
          request.scheduleDayId.trim();

        // עצירת הפעולה עם שגיאה כאשר !normalizedScheduleDayId.
        if (
          !normalizedScheduleDayId
        ) {
          // missingDayError — יום / שגיאה.
          const missingDayError =
            new Error(
              'Driver schedule day id is required.',
            );

          setState(
            (currentState) => ({
              ...currentState,

              error:
                normalizeDriverScheduleDraftError(
                  missingDayError,
                ),
            }),
          );

          throw missingDayError;
        }

        // schedulePeriodId — תקופת שיבוץ.
        const schedulePeriodId =
          state.data?.period?.id ??
          null;

        // עצירת הפעולה עם שגיאה כאשר !schedulePeriodId.
        if (!schedulePeriodId) {
          // missingPeriodError — תקופה / שגיאה.
          const missingPeriodError =
            new Error(
              'Driver schedule period id is required.',
            );

          setState(
            (currentState) => ({
              ...currentState,

              error:
                normalizeDriverScheduleDraftError(
                  missingPeriodError,
                ),
            }),
          );

          throw missingPeriodError;
        }

        setState(
          (currentState) => ({
            ...currentState,

            transferringDayId:
              normalizedScheduleDayId,

            error:
              null,

            lastTransferredDutyResult:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // result — תוצאה.
          const result =
            await driverScheduleService
              .transferMyDuty({
                ...request,

                scheduleDayId:
                  normalizedScheduleDayId,

                newDriverId:
                  request.newDriverId.trim(),
              });

          // refreshedData — נתונים.
          const refreshedData =
            await driverScheduleService
              .getScheduleById(
                schedulePeriodId,
              );

          setState(
            (currentState) => ({
              ...currentState,

              data:
                refreshedData,

              transferringDayId:
                null,

              error:
                null,

              lastTransferredDutyResult:
                result,
            }),
          );

          return result;
        } catch (error) {
          // normalizedError — שגיאה.
          const normalizedError =
            normalizeDriverScheduleDraftError(
              error,
            );

          setState(
            (currentState) => ({
              ...currentState,

              transferringDayId:
                null,

              error:
                normalizedError,

              lastTransferredDutyResult:
                null,
            }),
          );

          throw error;
        }
      },
      [
        state.data?.period?.id,
      ],
    );

  // clearError — שגיאה.
  const clearError =
    useCallback(
      (): void => {
        setState(
          (currentState) => ({
            ...currentState,

            error:
              null,
          }),
        );
      },
      [],
    );

  // clearLastUpdatedDayResult — יום / תוצאה.
  const clearLastUpdatedDayResult =
    useCallback(
      (): void => {
        setState(
          (currentState) => ({
            ...currentState,

            lastUpdatedDayResult:
              null,
          }),
        );
      },
      [],
    );

  const reset =
    useCallback(
      (): void => {
        setState(
          initialState,
        );
      },
      [],
    );

  return {
    state,

    loadLatestSchedule,

    loadScheduleById,

    loadScheduleByMonth,

    createDraft,

    updateScheduleDay,

    transferMyDuty,

    clearError,

    clearLastUpdatedDayResult,
    publishSchedule,
    reset,
  };
}