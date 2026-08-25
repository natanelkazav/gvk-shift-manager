import { supabase } from '../lib/supabase';

export interface CalendarHoliday {
  date: string;
  name: string;
  scheduleType: string | null;
}

async function getCalendarHolidays(year: number, month: number): Promise<CalendarHoliday[]> {
  const { data, error } = await supabase.rpc('get_calendar_holidays', {
    requested_year: year,
    requested_month: month,
  });

  if (error) {
    console.error('CALENDAR HOLIDAYS ERROR:', error);
    return [];
  }

  return Array.isArray(data) ? data as CalendarHoliday[] : [];
}

export const calendarHolidayService = { getCalendarHolidays };
