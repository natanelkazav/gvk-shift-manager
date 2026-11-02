/**
 * קובץ: src/services/calendarHolidayService.ts
 * מטרה: טעינת חגים וימים מיוחדים לשימוש בתצוגות ובחישובי השיבוץ.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: CalendarHoliday, getCalendarHolidays.
 * - קריאות RPC המופעלות בקובץ: get_calendar_holidays.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';

/**
 * חוזה הנתונים CalendarHoliday: לוח שנה / חג.
 */
export interface CalendarHoliday {
  // date — תאריך.
  date: string;
  // name — שם.
  name: string;
  // scheduleType — סוג יום השיבוץ.
  scheduleType: string | null;
}

/**
 * פעולה אסינכרונית getCalendarHolidays: שליפה או חישוב של לוח שנה / חגים.
 * הפעולה פונה ל־RPC: get_calendar_holidays.
 * @param year — שנה.
 * @param month — חודש.
 * @returns Promise<CalendarHoliday[]> — הפלט בהתאם לחתימה.
 */
async function getCalendarHolidays(year: number, month: number): Promise<CalendarHoliday[]> {
  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const { data, error } = await supabase.rpc('get_calendar_holidays', {
    requested_year: year,
    requested_month: month,
  });

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error.
  if (error) {
    console.error('CALENDAR HOLIDAYS ERROR:', error);
    return [];
  }

  return Array.isArray(data) ? data as CalendarHoliday[] : [];
}

// calendarHolidayService — לוח שנה / חג / שירות.
export const calendarHolidayService = { getCalendarHolidays };
