/**
 * קובץ: src/services/shiftSwapService.ts
 * מטרה: ניהול בקשות החלפה והעברה של משמרות והמרת תוצאות התהליך.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ShiftSwapActionRequest, normalizeSupabaseError, getFunctionErrorMessage, invokeShiftSwapAction, announceActivityChange, ShiftSwapService.
 * - קריאות RPC המופעלות בקובץ: get_shift_swap_create_options, get_shift_swap_requests.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import {
  FunctionsHttpError,
} from '@supabase/supabase-js';

import {
  supabase,
} from '../lib/supabase';

import type {
  CreateShiftSwapRequestInput,
  ShiftSwapCreateOptions,
  ShiftSwapMutationResult,
  ShiftSwapRequest,
} from '../types/shiftSwap';

/**
 * חוזה הנתונים ShiftSwapActionRequest: החלפת משמרות.
 */
interface ShiftSwapActionRequest {
  action:
    | 'create'
    | 'respond'
    | 'review'
    | 'cancel';

  payload:
    Record<string, unknown>;
}

/**
 * פעולה normalizeSupabaseError: נרמול שגיאה.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function normalizeSupabaseError(
  error: unknown,
): Error {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    return error;
  }

  if (
    typeof error ===
      'object' &&
    error !==
      null
  ) {
    const candidate =
      error as {
        // message — הודעה (אופציונלי).
        message?: unknown;
        details?: unknown;
        hint?: unknown;
      };

    // messages — הודעות.
    const messages = [
      typeof candidate.message ===
        'string'
        ? candidate.message
        : null,
      typeof candidate.details ===
        'string'
        ? candidate.details
        : null,
      typeof candidate.hint ===
        'string'
        ? candidate.hint
        : null,
    ].filter(
      (
        message,
      ): message is string =>
        Boolean(
          message,
        ),
    );

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר messages.length > 0.
    if (
      messages.length >
        0
    ) {
      return new Error(
        messages.join(
          ' | ',
        ),
      );
    }
  }

  return new Error(
    'אירעה שגיאה לא צפויה במערכת החלפות המשמרת.',
  );
}

/**
 * פעולה אסינכרונית getFunctionErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns Promise<string> — הפלט בהתאם לחתימה.
 */
async function getFunctionErrorMessage(
  error:
    FunctionsHttpError,
): Promise<string> {
  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
  try {
    // responseBody — תוצאת הפעולה / תוכן.
    const responseBody =
      await error.context
        .json() as {
          // error — שגיאה (אופציונלי).
          error?: unknown;
        };

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof responseBody.error === 'string' && responseBody.error.trim().
    if (
      typeof responseBody.error ===
        'string' &&
      responseBody.error.trim()
    ) {
      return responseBody.error;
    }
  } catch {
    // נחזיר את הודעת ברירת המחדל.
  }

  return (
    error.message ||
    'פעולת החלפת המשמרת נכשלה.'
  );
}

/**
 * פעולה אסינכרונית invokeShiftSwapAction: החלפת משמרות.
 * @param request — נתוני הבקשה.
 * @returns Promise<ShiftSwapMutationResult> — הפלט בהתאם לחתימה.
 */
async function invokeShiftSwapAction(
  request:
    ShiftSwapActionRequest,
): Promise<ShiftSwapMutationResult> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } =
    await supabase.functions
      .invoke(
        'shift-swap-action',
        {
          body:
            request,
        },
      );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (
    error
  ) {
    // עצירת הפעולה עם שגיאה כאשר error instanceof FunctionsHttpError.
    if (
      error instanceof
        FunctionsHttpError
    ) {
      throw new Error(
        await getFunctionErrorMessage(
          error,
        ),
      );
    }

    throw normalizeSupabaseError(
      error,
    );
  }

  // עצירת הפעולה עם שגיאה כאשר !data || typeof data !== 'object'.
  if (
    !data ||
    typeof data !==
      'object'
  ) {
    throw new Error(
      'לא התקבלה תשובה תקינה ממערכת החלפות המשמרת.',
    );
  }

  return data as
    ShiftSwapMutationResult;
}

/**
 * פעולה announceActivityChange: הנתון announceActivityChange בהקשר הפעולה.
 * @returns void — הפלט בהתאם לחתימה.
 */
function announceActivityChange(): void {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר typeof window === 'undefined'.
  if (
    typeof window ===
      'undefined'
  ) {
    return;
  }

  window.dispatchEvent(
    new Event(
      'gvk:activity-changed',
    ),
  );
}

/**
 * איגוד פעולות החלפת משמרות במחלקה ShiftSwapService.
 */
class ShiftSwapService {
  /**
   * פעולה אסינכרונית getCreateOptions: שליפה או חישוב של אפשרויות בחירה.
   * הפעולה פונה ל־RPC: get_shift_swap_create_options.
   * @returns Promise<ShiftSwapCreateOptions> — הפלט בהתאם לחתימה.
   */
  async getCreateOptions():
    Promise<ShiftSwapCreateOptions> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_shift_swap_create_options',
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (
      error
    ) {
      throw normalizeSupabaseError(
        error,
      );
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !data.
    if (
      !data
    ) {
      return {
        myShifts:
          [],
        dispatchers:
          [],
        counterpartyShifts:
          [],
      };
    }

    return data as
      ShiftSwapCreateOptions;
  }

  /**
   * פעולה אסינכרונית getRequests: שליפה או חישוב של הנתון getRequests בהקשר הפעולה.
   * הפעולה פונה ל־RPC: get_shift_swap_requests.
   * @returns Promise<ShiftSwapRequest[]> — הפלט בהתאם לחתימה.
   */
  async getRequests():
    Promise<ShiftSwapRequest[]> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_shift_swap_requests',
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (
      error
    ) {
      throw normalizeSupabaseError(
        error,
      );
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !Array.isArray( data, ).
    if (
      !Array.isArray(
        data,
      )
    ) {
      return [];
    }

    return data as
      ShiftSwapRequest[];
  }

  /**
   * פעולה אסינכרונית createRequest: יצירת נתוני הבקשה.
   * @param input — קלט.
   * @returns Promise<ShiftSwapMutationResult> — הפלט בהתאם לחתימה.
   */
  async createRequest(
    input:
      CreateShiftSwapRequestInput,
  ): Promise<ShiftSwapMutationResult> {
    // requesterShiftId — מזהה המשמרת.
    const requesterShiftId =
      input.requesterShiftId
        .trim();

    // counterpartyUserId — מזהה משתמש.
    const counterpartyUserId =
      input.counterpartyUserId
        .trim();

    // counterpartyShiftId — מזהה המשמרת.
    const counterpartyShiftId =
      input.counterpartyShiftId
        ?.trim() ||
      null;

    // עצירת הפעולה עם שגיאה כאשר !requesterShiftId.
    if (
      !requesterShiftId
    ) {
      throw new Error(
        'יש לבחור משמרת להחלפה.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !counterpartyUserId.
    if (
      !counterpartyUserId
    ) {
      throw new Error(
        'יש לבחור מוקדן מחליף.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר input.swapType === 'two_way' && !counterpartyShiftId.
    if (
      input.swapType ===
        'two_way' &&
      !counterpartyShiftId
    ) {
      throw new Error(
        'בהחלפה דו-כיוונית יש לבחור גם את המשמרת של המוקדן השני.',
      );
    }

    // result — תוצאה.
    const result =
      await invokeShiftSwapAction({
      action:
        'create',
      payload: {
        swapType:
          input.swapType,
        requesterShiftId,
        counterpartyUserId,
        counterpartyShiftId,
      },
      });

    announceActivityChange();

    return result;
  }

  /**
   * פעולה אסינכרונית respondToRequest: נתוני הבקשה.
   * @param requestId — מזהה הבקשה.
   * @param approve — הנתון approve בהקשר הפעולה.
   * @param rejectionReason — הנתון rejectionReason בהקשר הפעולה.
   * @returns Promise<ShiftSwapMutationResult> — הפלט בהתאם לחתימה.
   */
  async respondToRequest(
    requestId:
      string,
    approve:
      boolean,
    rejectionReason?:
      string,
  ): Promise<ShiftSwapMutationResult> {
    // normalizedRequestId — מזהה הבקשה.
    const normalizedRequestId =
      requestId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedRequestId.
    if (
      !normalizedRequestId
    ) {
      throw new Error(
        'לא התקבל מזהה בקשת החלפה.',
      );
    }

    // result — תוצאה.
    const result =
      await invokeShiftSwapAction({
      action:
        'respond',
      payload: {
        requestId:
          normalizedRequestId,
        approve,
        rejectionReason:
          rejectionReason
            ?.trim() ||
          null,
      },
      });

    announceActivityChange();

    return result;
  }

  /**
   * פעולה אסינכרונית reviewRequest: נתוני הבקשה.
   * @param requestId — מזהה הבקשה.
   * @param approve — הנתון approve בהקשר הפעולה.
   * @param rejectionReason — הנתון rejectionReason בהקשר הפעולה.
   * @returns Promise<ShiftSwapMutationResult> — הפלט בהתאם לחתימה.
   */
  async reviewRequest(
    requestId:
      string,
    approve:
      boolean,
    rejectionReason?:
      string,
  ): Promise<ShiftSwapMutationResult> {
    // normalizedRequestId — מזהה הבקשה.
    const normalizedRequestId =
      requestId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedRequestId.
    if (
      !normalizedRequestId
    ) {
      throw new Error(
        'לא התקבל מזהה בקשת החלפה.',
      );
    }

    // result — תוצאה.
    const result =
      await invokeShiftSwapAction({
      action:
        'review',
      payload: {
        requestId:
          normalizedRequestId,
        approve,
        rejectionReason:
          rejectionReason
            ?.trim() ||
          null,
      },
      });

    announceActivityChange();

    return result;
  }

  /**
   * פעולה אסינכרונית cancelRequest: ביטול נתוני הבקשה.
   * @param requestId — מזהה הבקשה.
   * @returns Promise<ShiftSwapMutationResult> — הפלט בהתאם לחתימה.
   */
  async cancelRequest(
    requestId:
      string,
  ): Promise<ShiftSwapMutationResult> {
    // normalizedRequestId — מזהה הבקשה.
    const normalizedRequestId =
      requestId.trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedRequestId.
    if (
      !normalizedRequestId
    ) {
      throw new Error(
        'לא התקבל מזהה בקשת החלפה.',
      );
    }

    // result — תוצאה.
    const result =
      await invokeShiftSwapAction({
      action:
        'cancel',
      payload: {
        requestId:
          normalizedRequestId,
      },
      });

    announceActivityChange();

    return result;
  }
}

// shiftSwapService — החלפת משמרות.
export const shiftSwapService =
  new ShiftSwapService();
