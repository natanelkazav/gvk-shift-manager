import { supabase } from '../lib/supabase';
import type {
  CreateShiftSwapRequestInput,
  ShiftSwapCreateOptions,
  ShiftSwapMutationResult,
  ShiftSwapRequest,
} from '../types/shiftSwap';


async function deliverWorkflowNotifications(
  result: ShiftSwapMutationResult,
): Promise<void> {
  const notificationIds =
    Array.isArray(result.notificationIds)
      ? result.notificationIds.filter(
          (notificationId): notificationId is string =>
            typeof notificationId === 'string' &&
            Boolean(notificationId.trim()),
        )
      : [];

  if (notificationIds.length === 0) {
    return;
  }

  const deliveries =
    await Promise.allSettled(
      notificationIds.map(
        async (notificationId) => {
          const { error } =
            await supabase.functions.invoke(
              'send-notification',
              {
                body: {
                  notificationId,
                },
              },
            );

          if (error) {
            throw error;
          }
        },
      ),
    );

  deliveries.forEach(
    (delivery, index) => {
      if (delivery.status === 'rejected') {
        console.error(
          'Shift swap Push delivery failed:',
          {
            notificationId:
              notificationIds[index],
            error: delivery.reason,
          },
        );
      }
    },
  );
}

function normalizeSupabaseError(
  error: unknown,
): Error {
  if (error instanceof Error) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null
  ) {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    const messages = [
      typeof candidate.message === 'string'
        ? candidate.message
        : null,
      typeof candidate.details === 'string'
        ? candidate.details
        : null,
      typeof candidate.hint === 'string'
        ? candidate.hint
        : null,
    ].filter(
      (
        message,
      ): message is string =>
        Boolean(message),
    );

    if (messages.length > 0) {
      return new Error(
        messages.join(' | '),
      );
    }
  }

  return new Error(
    'אירעה שגיאה לא צפויה במערכת החלפות המשמרת.',
  );
}

class ShiftSwapService {
  async getCreateOptions():
    Promise<ShiftSwapCreateOptions> {
    const {
      data,
      error,
    } = await supabase.rpc(
      'get_shift_swap_create_options',
    );

    if (error) {
      throw normalizeSupabaseError(
        error,
      );
    }

    if (!data) {
      return {
        myShifts: [],
        dispatchers: [],
        counterpartyShifts: [],
      };
    }

    return data as ShiftSwapCreateOptions;
  }

  async getRequests():
    Promise<ShiftSwapRequest[]> {
    const {
      data,
      error,
    } = await supabase.rpc(
      'get_shift_swap_requests',
    );

    if (error) {
      throw normalizeSupabaseError(
        error,
      );
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data as ShiftSwapRequest[];
  }

  async createRequest(
    input: CreateShiftSwapRequestInput,
  ): Promise<ShiftSwapMutationResult> {
    const requesterShiftId =
      input.requesterShiftId.trim();

    const counterpartyUserId =
      input.counterpartyUserId.trim();

    const counterpartyShiftId =
      input.counterpartyShiftId
        ?.trim() || null;

    if (!requesterShiftId) {
      throw new Error(
        'יש לבחור משמרת להחלפה.',
      );
    }

    if (!counterpartyUserId) {
      throw new Error(
        'יש לבחור מוקדן מחליף.',
      );
    }

    if (
      input.swapType === 'two_way' &&
      !counterpartyShiftId
    ) {
      throw new Error(
        'בהחלפה דו-כיוונית יש לבחור גם את המשמרת של המוקדן השני.',
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      'create_shift_swap_request',
      {
        requested_swap_type:
          input.swapType,
        requested_requester_shift_id:
          requesterShiftId,
        requested_counterparty_user_id:
          counterpartyUserId,
        requested_counterparty_shift_id:
          counterpartyShiftId,
      },
    );

    if (error) {
      throw normalizeSupabaseError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת יצירת בקשת ההחלפה.',
      );
    }

    const result =
      data as ShiftSwapMutationResult;

    await deliverWorkflowNotifications(
      result,
    );

    return result;
  }

  async respondToRequest(
    requestId: string,
    approve: boolean,
    rejectionReason?: string,
  ): Promise<ShiftSwapMutationResult> {
    const normalizedRequestId =
      requestId.trim();

    if (!normalizedRequestId) {
      throw new Error(
        'לא התקבל מזהה בקשת החלפה.',
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      'respond_to_shift_swap_request',
      {
        requested_request_id:
          normalizedRequestId,
        requested_approve:
          approve,
        requested_rejection_reason:
          rejectionReason?.trim() || null,
      },
    );

    if (error) {
      throw normalizeSupabaseError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת עדכון בקשת ההחלפה.',
      );
    }

    const result =
      data as ShiftSwapMutationResult;

    await deliverWorkflowNotifications(
      result,
    );

    return result;
  }

  async reviewRequest(
    requestId: string,
    approve: boolean,
    rejectionReason?: string,
  ): Promise<ShiftSwapMutationResult> {
    const normalizedRequestId =
      requestId.trim();

    if (!normalizedRequestId) {
      throw new Error(
        'לא התקבל מזהה בקשת החלפה.',
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      'review_shift_swap_request',
      {
        requested_request_id:
          normalizedRequestId,
        requested_approve:
          approve,
        requested_rejection_reason:
          rejectionReason?.trim() || null,
      },
    );

    if (error) {
      throw normalizeSupabaseError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת אישור בקשת ההחלפה.',
      );
    }

    const result =
      data as ShiftSwapMutationResult;

    await deliverWorkflowNotifications(
      result,
    );

    return result;
  }

  async cancelRequest(
    requestId: string,
  ): Promise<ShiftSwapMutationResult> {
    const normalizedRequestId =
      requestId.trim();

    if (!normalizedRequestId) {
      throw new Error(
        'לא התקבל מזהה בקשת החלפה.',
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      'cancel_shift_swap_request',
      {
        requested_request_id:
          normalizedRequestId,
      },
    );

    if (error) {
      throw normalizeSupabaseError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת ביטול בקשת ההחלפה.',
      );
    }

    const result =
      data as ShiftSwapMutationResult;

    await deliverWorkflowNotifications(
      result,
    );

    return result;
  }
}

export const shiftSwapService =
  new ShiftSwapService();
