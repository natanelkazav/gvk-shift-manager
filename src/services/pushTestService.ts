import {
  supabase,
} from '../lib/supabase';

export interface SendTestPushRequest {
  targetUserId: string;

  title: string;

  body: string;

  url?: string;
}

export interface SendTestPushResponse {
  success: boolean;

  targetUserId: string;

  totalDevices: number;

  sent: number;

  failed: number;

  failures: Array<{
    subscriptionId: string;

    statusCode: number | null;

    message: string;
  }>;
}

class PushTestService {
  async sendTestPush(
    request:
      SendTestPushRequest,
  ): Promise<SendTestPushResponse> {
    const targetUserId =
      request.targetUserId.trim();

    const title =
      request.title.trim();

    const body =
      request.body.trim();

    if (!targetUserId) {
      throw new Error(
        'יש לבחור משתמש לקבלת ההתראה.',
      );
    }

    if (!title) {
      throw new Error(
        'יש להזין כותרת להתראה.',
      );
    }

    if (!body) {
      throw new Error(
        'יש להזין תוכן להתראה.',
      );
    }

    const {
      data,
      error,
    } =
      await supabase.functions
        .invoke(
          'send-test-push',
          {
            body: {
              targetUserId,

              title,

              body,

              url:
                request.url?.trim() ||
                '/',
            },
          },
        );

    if (error) {
      throw error;
    }

    if (
      typeof data !==
        'object' ||
      data ===
        null
    ) {
      throw new Error(
        'התקבלה תשובה לא תקינה מפונקציית שליחת ההתראה.',
      );
    }

    const response =
      data as
        Partial<SendTestPushResponse> & {
          error?: unknown;
        };

    if (
      typeof response.error ===
      'string'
    ) {
      throw new Error(
        response.error,
      );
    }

    if (
      typeof response.success !==
        'boolean' ||
      typeof response.targetUserId !==
        'string' ||
      typeof response.totalDevices !==
        'number' ||
      typeof response.sent !==
        'number' ||
      typeof response.failed !==
        'number'
    ) {
      throw new Error(
        'תוצאת שליחת ההתראה אינה תקינה.',
      );
    }

    return {
      success:
        response.success,

      targetUserId:
        response.targetUserId,

      totalDevices:
        response.totalDevices,

      sent:
        response.sent,

      failed:
        response.failed,

      failures:
        Array.isArray(
          response.failures,
        )
          ? response.failures
          : [],
    };
  }
}

export const pushTestService =
  new PushTestService();