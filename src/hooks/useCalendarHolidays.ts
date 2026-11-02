/**
 * קובץ: src/hooks/useCalendarHolidays.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור לוח שנה / חגים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: useCalendarHolidays.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import { useEffect, useMemo, useState } from 'react';
import { calendarHolidayService } from '../services/calendarHolidayService';

/**
 * פעולה useCalendarHolidays: חיבור מצב או הקשר עבור לוח שנה / חגים.
 * @param year — שנה.
 * @param month — חודש.
 */
export function useCalendarHolidays(year: number, month: number) {
  // מצב מקומי: items — פריטים; setItems מעדכנת אותו ומפעילה רינדור לפי React.
  const [items, setItems] = useState<Array<{date:string;name:string;scheduleType:string|null}>>([]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [year, month].
  useEffect(() => {
    let cancelled = false;
    void calendarHolidayService.getCalendarHolidays(year, month).then((result) => {
      if (!cancelled) setItems(result);
    });
    return () => { cancelled = true; };
  }, [year, month]);

  return useMemo(() => {
    // map — מפת התאמה; מיפוי לחיפוש לפי מפתח.
    const map = new Map<string, string[]>();
    // עיבוד כל פריט מתוך items בנפרד.
    for (const item of items) {
      // current — הנתון current בהקשר הפעולה.
      const current = map.get(item.date) ?? [];
      if (!current.includes(item.name)) current.push(item.name);
      map.set(item.date, current);
    }
    return map;
  }, [items]);
}
