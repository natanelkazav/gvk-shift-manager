import {
  supabase,
} from '../lib/supabase';

export interface NotificationPreferences {
  userId: string;

  pushEnabled: boolean;

  shiftRemindersEnabled: boolean;

  shiftReminderMinutesBefore: number;

  createdAt: string;

  updatedAt: string;
}

export interface UpdateNotificationPreferencesRequest {
  pushEnabled: boolean;

  shiftRemindersEnabled: boolean;

  shiftReminderMinutesBefore: number;
}

interface NotificationPreferencesRow {
  user_id: string;

  push_enabled: boolean;

  shift_reminders_enabled: boolean;

  shift_reminder_minutes_before: number;

  created_at: string;

  updated_at: string;
}

function mapNotificationPreferences(
  row:
    NotificationPreferencesRow,
): NotificationPreferences {
  return {
    userId:
      row.user_id,

    pushEnabled:
      row.push_enabled,

    shiftRemindersEnabled:
      row.shift_reminders_enabled,

    shiftReminderMinutesBefore:
      row.shift_reminder_minutes_before,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}
function parseNotificationPreferencesRow(
  value: unknown,
): NotificationPreferencesRow {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    throw new Error(
      'התקבלה תשובה לא תקינה בעת טעינת הגדרות ההתראות.',
    );
  }

  const row =
    value as Partial<NotificationPreferencesRow>;

  if (
    typeof row.user_id !== 'string' ||
    typeof row.push_enabled !== 'boolean' ||
    typeof row.shift_reminders_enabled !== 'boolean' ||
    typeof row.shift_reminder_minutes_before !== 'number' ||
    typeof row.created_at !== 'string' ||
    typeof row.updated_at !== 'string'
  ) {
    throw new Error(
      'התקבלה תשובה חסרה או לא תקינה מהשרת.',
    );
  }

  return {
    user_id:
      row.user_id,

    push_enabled:
      row.push_enabled,

    shift_reminders_enabled:
      row.shift_reminders_enabled,

    shift_reminder_minutes_before:
      row.shift_reminder_minutes_before,

    created_at:
      row.created_at,

    updated_at:
      row.updated_at,
  };
}
function validateReminderMinutes(
  value: number,
): void {
  if (
    !Number.isInteger(
      value,
    ) ||
    value < 0 ||
    value > 1440
  ) {
    throw new Error(
      'מספר הדקות לפני המשמרת חייב להיות מספר שלם בין 0 ל־1440.',
    );
  }
}

async function getAuthenticatedUserId():
  Promise<string> {
  const {
    data,
    error,
  } =
    await supabase.auth
      .getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error(
      'לא נמצא משתמש מחובר.',
    );
  }

  return data.user.id;
}

class NotificationPreferencesService {
  async getMyPreferences():
    Promise<NotificationPreferences> {
    const userId =
      await getAuthenticatedUserId();

    const {
      data,
      error,
    } =
      await supabase
        .from(
          'notification_preferences',
        )
        .select(
          [
            'user_id',
            'push_enabled',
            'shift_reminders_enabled',
            'shift_reminder_minutes_before',
            'created_at',
            'updated_at',
          ].join(
            ',',
          ),
        )
        .eq(
          'user_id',
          userId,
        )
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
        return mapNotificationPreferences(
          parseNotificationPreferencesRow(
            data,
          ),
        );
    }

    const {
      data:
        createdData,

      error:
        createError,
    } =
      await supabase
        .from(
          'notification_preferences',
        )
        .insert({
          user_id:
            userId,

          push_enabled:
            true,

          shift_reminders_enabled:
            true,

          shift_reminder_minutes_before:
            10,
        })
        .select(
          [
            'user_id',
            'push_enabled',
            'shift_reminders_enabled',
            'shift_reminder_minutes_before',
            'created_at',
            'updated_at',
          ].join(
            ',',
          ),
        )
        .single();

    if (createError) {
      throw createError;
    }

    return mapNotificationPreferences(
      parseNotificationPreferencesRow(
        createdData,
      ),
    );
  }

  async updateMyPreferences(
    request:
      UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferences> {
    validateReminderMinutes(
      request
        .shiftReminderMinutesBefore,
    );

    const userId =
      await getAuthenticatedUserId();

    const {
      data,
      error,
    } =
      await supabase
        .from(
          'notification_preferences',
        )
        .upsert(
          {
            user_id:
              userId,

            push_enabled:
              request.pushEnabled,

            shift_reminders_enabled:
              request
                .shiftRemindersEnabled,

            shift_reminder_minutes_before:
              request
                .shiftReminderMinutesBefore,
          },
          {
            onConflict:
              'user_id',
          },
        )
        .select(
          [
            'user_id',
            'push_enabled',
            'shift_reminders_enabled',
            'shift_reminder_minutes_before',
            'created_at',
            'updated_at',
          ].join(
            ',',
          ),
        )
        .single();

    if (error) {
      throw error;
    }

    return mapNotificationPreferences(
      parseNotificationPreferencesRow(
        data,
      ),
    );
  }
}

export const notificationPreferencesService =
  new NotificationPreferencesService();