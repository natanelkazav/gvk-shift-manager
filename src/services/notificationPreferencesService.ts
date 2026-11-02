/**
 * קובץ: src/services/notificationPreferencesService.ts
 * מטרה: טעינה ושמירה של העדפות ההתראות האישיות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: NotificationPreferences, UpdateNotificationPreferencesRequest, NotificationPreferencesRow, mapNotificationPreferences, parseNotificationPreferencesRow, validateReminderMinutes, normalizeReminderTime, getAuthenticatedUserId, NotificationPreferencesService.
 * - מקורות נתונים הנזכרים בקריאות from: notification_preferences.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import {
  supabase,
} from '../lib/supabase';

/**
 * חוזה הנתונים NotificationPreferences: התראות.
 */
export interface NotificationPreferences {
  // userId — מזהה משתמש.
  userId: string;

  // pushEnabled — התראות Push / האם האפשרות מופעלת.
  pushEnabled: boolean;

  // shiftRemindersEnabled — משמרת / תזכורות / האם האפשרות מופעלת.
  shiftRemindersEnabled: boolean;

  // shiftReminderMinutesBefore — משמרת / תזכורות / דקות.
  shiftReminderMinutesBefore: number;

  // driverDutyRemindersEnabled — כוננים / תזכורות / האם האפשרות מופעלת.
  driverDutyRemindersEnabled: boolean;

  // driverDutyReminderTime — כוננים / תזכורות / זמן.
  driverDutyReminderTime: string;

  // createdAt — מועד יצירה.
  createdAt: string;

  // updatedAt — מועד עדכון.
  updatedAt: string;
}

/**
 * חוזה הנתונים UpdateNotificationPreferencesRequest: התראות / נתוני הבקשה.
 */
export interface UpdateNotificationPreferencesRequest {
  // pushEnabled — התראות Push / האם האפשרות מופעלת.
  pushEnabled: boolean;

  // shiftRemindersEnabled — משמרת / תזכורות / האם האפשרות מופעלת.
  shiftRemindersEnabled: boolean;

  // shiftReminderMinutesBefore — משמרת / תזכורות / דקות.
  shiftReminderMinutesBefore: number;

  // driverDutyRemindersEnabled — כוננים / תזכורות / האם האפשרות מופעלת.
  driverDutyRemindersEnabled: boolean;

  // driverDutyReminderTime — כוננים / תזכורות / זמן.
  driverDutyReminderTime: string;
}

/**
 * חוזה הנתונים NotificationPreferencesRow: התראות / שורה.
 */
interface NotificationPreferencesRow {
  // user_id — מזהה משתמש.
  user_id: string;

  // push_enabled — התראות Push / האם האפשרות מופעלת.
  push_enabled: boolean;

  // shift_reminders_enabled — משמרת / תזכורות / האם האפשרות מופעלת.
  shift_reminders_enabled: boolean;

  // shift_reminder_minutes_before — משמרת / תזכורות / דקות.
  shift_reminder_minutes_before: number;

  // driver_duty_reminders_enabled — כוננים / תזכורות / האם האפשרות מופעלת.
  driver_duty_reminders_enabled: boolean;

  // driver_duty_reminder_time — כוננים / תזכורות / זמן.
  driver_duty_reminder_time: string;

  // created_at — מועד יצירה.
  created_at: string;

  // updated_at — מועד עדכון.
  updated_at: string;
}

/**
 * פעולה mapNotificationPreferences: מיפוי מפת התאמה / התראות.
 * @param row — שורה.
 * @returns NotificationPreferences — הפלט בהתאם לחתימה.
 */
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

    driverDutyRemindersEnabled:
      row.driver_duty_reminders_enabled,

    driverDutyReminderTime:
      row.driver_duty_reminder_time
        .slice(
          0,
          5,
        ),

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}

/**
 * פעולה parseNotificationPreferencesRow: פענוח קלט עבור התראות / שורה.
 * @param value — ערך.
 * @returns NotificationPreferencesRow — הפלט בהתאם לחתימה.
 */
function parseNotificationPreferencesRow(
  value: unknown,
): NotificationPreferencesRow {
  // עצירת הפעולה עם שגיאה כאשר typeof value !== 'object' || value === null.
  if (
    typeof value !==
      'object' ||
    value ===
      null
  ) {
    throw new Error(
      'התקבלה תשובה לא תקינה בעת טעינת הגדרות ההתראות.',
    );
  }

  // row — שורה.
  const row =
    value as
      Partial<NotificationPreferencesRow>;

  // עצירת הפעולה עם שגיאה כאשר typeof row.user_id !== 'string' || typeof row.push_enabled !== 'boolean' || typeof row.shift_reminders_enabled !== 'boolean' || typeof row.s.
  if (
    typeof row.user_id !==
      'string' ||
    typeof row.push_enabled !==
      'boolean' ||
    typeof row.shift_reminders_enabled !==
      'boolean' ||
    typeof row.shift_reminder_minutes_before !==
      'number' ||
    typeof row.driver_duty_reminders_enabled !==
      'boolean' ||
    typeof row.driver_duty_reminder_time !==
      'string' ||
    typeof row.created_at !==
      'string' ||
    typeof row.updated_at !==
      'string'
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

    driver_duty_reminders_enabled:
      row.driver_duty_reminders_enabled,

    driver_duty_reminder_time:
      row.driver_duty_reminder_time,

    created_at:
      row.created_at,

    updated_at:
      row.updated_at,
  };
}

/**
 * פעולה validateReminderMinutes: בדיקת תקינות של תזכורות / דקות.
 * @param value — ערך.
 * @returns void — הפלט בהתאם לחתימה.
 */
function validateReminderMinutes(
  value: number,
): void {
  // עצירת הפעולה עם שגיאה כאשר !Number.isInteger( value, ) || value < 0 || value > 1440.
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

/**
 * פעולה normalizeReminderTime: נרמול תזכורות / זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeReminderTime(
  value: string,
): string {
  // normalizedValue — ערך.
  const normalizedValue =
    value.trim();

  // עצירת הפעולה עם שגיאה כאשר !/^([01]\d|2[0-3]):[0-5]\d$/.test( normalizedValue, ).
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      normalizedValue,
    )
  ) {
    throw new Error(
      'יש לבחור שעה תקינה לתזכורת הכוננות.',
    );
  }

  return normalizedValue;
}

/**
 * פעולה אסינכרונית getAuthenticatedUserId: אימות המשתמש באמצעות auth.getUser ושליפת מזהה המשתמש מהתשובה.
 * @returns Promise<string> — הפלט בהתאם לחתימה.
 */
async function getAuthenticatedUserId():
  Promise<string> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } =
    await supabase.auth
      .getUser();

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    throw error;
  }

  // עצירת הפעולה עם שגיאה כאשר !data.user.
  if (!data.user) {
    throw new Error(
      'לא נמצא משתמש מחובר.',
    );
  }

  return data.user.id;
}

// preferenceSelectColumns — הנתון preferenceSelectColumns בהקשר הפעולה.
const preferenceSelectColumns = [
  'user_id',
  'push_enabled',
  'shift_reminders_enabled',
  'shift_reminder_minutes_before',
  'driver_duty_reminders_enabled',
  'driver_duty_reminder_time',
  'created_at',
  'updated_at',
].join(
  ',',
);

/**
 * איגוד פעולות התראות / שירות במחלקה NotificationPreferencesService.
 */
class NotificationPreferencesService {
  /**
   * פעולה אסינכרונית getMyPreferences: שליפה או חישוב של הנתון getMyPreferences בהקשר הפעולה.
   * @returns Promise<NotificationPreferences> — הפלט בהתאם לחתימה.
   */
  async getMyPreferences():
    Promise<NotificationPreferences> {
    // userId — מזהה משתמש.
    const userId =
      await getAuthenticatedUserId();

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase
        .from(
          'notification_preferences',
        )
        .select(
          preferenceSelectColumns,
        )
        .eq(
          'user_id',
          userId,
        )
        .maybeSingle();

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw error;
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר data.
    if (data) {
      return mapNotificationPreferences(
        parseNotificationPreferencesRow(
          data,
        ),
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

          driver_duty_reminders_enabled:
            false,

          driver_duty_reminder_time:
            '09:00',
        })
        .select(
          preferenceSelectColumns,
        )
        .single();

    // עצירת הפעולה עם שגיאה כאשר createError.
    if (createError) {
      throw createError;
    }

    return mapNotificationPreferences(
      parseNotificationPreferencesRow(
        createdData,
      ),
    );
  }

  /**
   * פעולה אסינכרונית updateMyPreferences: עדכון הנתון updateMyPreferences בהקשר הפעולה.
   * @param request — נתוני הבקשה.
   * @returns Promise<NotificationPreferences> — הפלט בהתאם לחתימה.
   */
  async updateMyPreferences(
    request:
      UpdateNotificationPreferencesRequest,
  ): Promise<NotificationPreferences> {
    validateReminderMinutes(
      request
        .shiftReminderMinutesBefore,
    );

    // normalizedDutyReminderTime — תזכורות / זמן.
    const normalizedDutyReminderTime =
      normalizeReminderTime(
        request.driverDutyReminderTime,
      );

    // userId — מזהה משתמש.
    const userId =
      await getAuthenticatedUserId();

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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

            driver_duty_reminders_enabled:
              request
                .driverDutyRemindersEnabled,

            driver_duty_reminder_time:
              normalizedDutyReminderTime,
          },
          {
            onConflict:
              'user_id',
          },
        )
        .select(
          preferenceSelectColumns,
        )
        .single();

    // עצירת הפעולה עם שגיאה כאשר error.
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

// notificationPreferencesService — התראות / שירות.
export const notificationPreferencesService =
  new NotificationPreferencesService();
