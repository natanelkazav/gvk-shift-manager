import { useEffect, useMemo, useState } from 'react';
import { calendarHolidayService } from '../services/calendarHolidayService';

export function useCalendarHolidays(year: number, month: number) {
  const [items, setItems] = useState<Array<{date:string;name:string;scheduleType:string|null}>>([]);

  useEffect(() => {
    let cancelled = false;
    void calendarHolidayService.getCalendarHolidays(year, month).then((result) => {
      if (!cancelled) setItems(result);
    });
    return () => { cancelled = true; };
  }, [year, month]);

  return useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of items) {
      const current = map.get(item.date) ?? [];
      if (!current.includes(item.name)) current.push(item.name);
      map.set(item.date, current);
    }
    return map;
  }, [items]);
}
