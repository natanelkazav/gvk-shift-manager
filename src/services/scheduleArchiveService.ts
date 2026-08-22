import {
  supabase,
} from '../lib/supabase';

interface SendScheduleArchiveResponse {
  success: boolean;
  emailId: string | null;
  auditLogged: boolean;
}

interface FunctionErrorResponse {
  error?: string;
}

async function blobToBase64(
  blob: Blob,
): Promise<string> {
  const buffer =
    await blob
      .arrayBuffer();

  const bytes =
    new Uint8Array(
      buffer,
    );

  const chunkSize =
    0x8000;

  let binary =
    '';

  for (
    let offset = 0;
    offset < bytes.length;
    offset +=
      chunkSize
  ) {
    const chunk =
      bytes.subarray(
        offset,
        Math.min(
          offset +
            chunkSize,
          bytes.length,
        ),
      );

    binary +=
      String.fromCharCode(
        ...chunk,
      );
  }

  return window.btoa(
    binary,
  );
}

async function getFunctionErrorMessage(
  error: unknown,
): Promise<string> {
  if (
    typeof error ===
      'object' &&
    error !==
      null &&
    'context' in
      error
  ) {
    const context =
      (
        error as {
          context?:
            Response;
        }
      ).context;

    if (
      context instanceof
        Response
    ) {
      try {
        const body =
          await context
            .json() as
            FunctionErrorResponse;

        if (
          body.error
        ) {
          return body.error;
        }
      } catch {
        // Use the generic message below.
      }
    }
  }

  if (
    error instanceof
      Error &&
    error.message
      .trim()
  ) {
    return error.message;
  }

  return 'לא ניתן היה לשלוח את קובץ השיבוצים.';
}

class ScheduleArchiveService {
  async sendScheduleFile(
    blob: Blob,
    fileName: string,
    year: number,
    month: number,
  ): Promise<SendScheduleArchiveResponse> {
    if (
      blob.size ===
        0
    ) {
      throw new Error(
        'קובץ השיבוצים שנוצר ריק.',
      );
    }

    /*
     * קובץ שיבוצים אמור להיות קטן משמעותית.
     * המגבלה מונעת שליחת payload חריג בטעות.
     */
    if (
      blob.size >
        8 *
        1024 *
        1024
    ) {
      throw new Error(
        'קובץ השיבוצים גדול מדי לשליחה אוטומטית.',
      );
    }

    const fileBase64 =
      await blobToBase64(
        blob,
      );

    const {
      data,
      error,
    } =
      await supabase.functions
        .invoke<
          SendScheduleArchiveResponse
        >(
          'send-schedule-archive',
          {
            body: {
              fileName,
              fileBase64,
              year,
              month,
            },
          },
        );

    if (
      error
    ) {
      throw new Error(
        await getFunctionErrorMessage(
          error,
        ),
      );
    }

    if (
      !data ||
      data.success !==
        true
    ) {
      throw new Error(
        'השרת לא אישר שהמייל נשלח.',
      );
    }

    return data;
  }
}

export const scheduleArchiveService =
  new ScheduleArchiveService();
