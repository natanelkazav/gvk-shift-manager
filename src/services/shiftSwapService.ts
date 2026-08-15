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

interface ShiftSwapActionRequest {
  action:
    | 'create'
    | 'respond'
    | 'review'
    | 'cancel';

  payload:
    Record<string, unknown>;
}

function normalizeSupabaseError(
  error: unknown,
): Error {
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
        message?: unknown;
        details?: unknown;
        hint?: unknown;
      };

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

async function getFunctionErrorMessage(
  error:
    FunctionsHttpError,
): Promise<string> {
  try {
    const responseBody =
      await error.context
        .json() as {
          error?: unknown;
        };

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

async function invokeShiftSwapAction(
  request:
    ShiftSwapActionRequest,
): Promise<ShiftSwapMutationResult> {
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

  if (
    error
  ) {
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

class ShiftSwapService {
  async getCreateOptions():
    Promise<ShiftSwapCreateOptions> {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_shift_swap_create_options',
      );

    if (
      error
    ) {
      throw normalizeSupabaseError(
        error,
      );
    }

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

  async getRequests():
    Promise<ShiftSwapRequest[]> {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_shift_swap_requests',
      );

    if (
      error
    ) {
      throw normalizeSupabaseError(
        error,
      );
    }

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

  async createRequest(
    input:
      CreateShiftSwapRequestInput,
  ): Promise<ShiftSwapMutationResult> {
    const requesterShiftId =
      input.requesterShiftId
        .trim();

    const counterpartyUserId =
      input.counterpartyUserId
        .trim();

    const counterpartyShiftId =
      input.counterpartyShiftId
        ?.trim() ||
      null;

    if (
      !requesterShiftId
    ) {
      throw new Error(
        'יש לבחור משמרת להחלפה.',
      );
    }

    if (
      !counterpartyUserId
    ) {
      throw new Error(
        'יש לבחור מוקדן מחליף.',
      );
    }

    if (
      input.swapType ===
        'two_way' &&
      !counterpartyShiftId
    ) {
      throw new Error(
        'בהחלפה דו-כיוונית יש לבחור גם את המשמרת של המוקדן השני.',
      );
    }

    return invokeShiftSwapAction({
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
  }

  async respondToRequest(
    requestId:
      string,
    approve:
      boolean,
    rejectionReason?:
      string,
  ): Promise<ShiftSwapMutationResult> {
    const normalizedRequestId =
      requestId.trim();

    if (
      !normalizedRequestId
    ) {
      throw new Error(
        'לא התקבל מזהה בקשת החלפה.',
      );
    }

    return invokeShiftSwapAction({
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
  }

  async reviewRequest(
    requestId:
      string,
    approve:
      boolean,
    rejectionReason?:
      string,
  ): Promise<ShiftSwapMutationResult> {
    const normalizedRequestId =
      requestId.trim();

    if (
      !normalizedRequestId
    ) {
      throw new Error(
        'לא התקבל מזהה בקשת החלפה.',
      );
    }

    return invokeShiftSwapAction({
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
  }

  async cancelRequest(
    requestId:
      string,
  ): Promise<ShiftSwapMutationResult> {
    const normalizedRequestId =
      requestId.trim();

    if (
      !normalizedRequestId
    ) {
      throw new Error(
        'לא התקבל מזהה בקשת החלפה.',
      );
    }

    return invokeShiftSwapAction({
      action:
        'cancel',
      payload: {
        requestId:
          normalizedRequestId,
      },
    });
  }
}

export const shiftSwapService =
  new ShiftSwapService();
