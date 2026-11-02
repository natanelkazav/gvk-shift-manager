/**
 * קובץ: src/pages/MyDynamicShiftsPage.tsx
 * מטרה: מימוש מסך המשתמש עבור דינמי / משמרות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ViewMode, selfEditCandidateLabel, localDate, formatDate, formatTime, modeTitle, changeModeText, MyDynamicShiftsPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, List, LoaderCircle, Pencil, RefreshCw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import MonthCalendar from '../components/calendar/MonthCalendar';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { calendarHolidayService, type CalendarHoliday } from '../services/calendarHolidayService';
import { dynamicSchedulingService } from '../services/dynamicSchedulingService';
import type {
  MyOnCallCoverageConflict,
  MyDynamicSchedulePeriod,
  MyDynamicScheduleWorkspace,
  MyDynamicScheduleAssignment,
  DynamicSelfEditWorkspace,
  DynamicShiftExchangeOptions,
  DynamicShiftExchangeType,
} from '../types/dynamicScheduling';
import '../styles/myDynamicShifts.css';
import { dynamicShiftDisplayName } from '../utils/dynamicShiftDisplayName';

/**
 * טיפוס ViewMode: מצב פעולה.
 */
type ViewMode = 'list' | 'calendar';

// weekdays — הנתון weekdays בהקשר הפעולה.
const weekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// availabilityLabel — אילוצים וזמינות / תווית.
const availabilityLabel: Record<string, string> = {
  preferred: 'מעדיף',
  available: 'זמין',
  avoid: 'מעדיף שלא',
  unavailable: 'לא זמין',
};

/**
 * פעולה selfEditCandidateLabel: תווית.
 * @param displayName — שם תצוגה.
 * @param status — סטטוס.
 * @returns string — הפלט בהתאם לחתימה.
 */
function selfEditCandidateLabel(displayName: string, status: string | null): string {
  return `${displayName} · ${status ? availabilityLabel[status] ?? status : 'לא הוגש'}`;
}

/**
 * פעולה localDate: תאריך.
 * @param value — ערך.
 * @returns Date — הפלט בהתאם לחתימה.
 */
function localDate(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * פעולה formatDate: עיצוב ערך לתצוגה עבור תאריך.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/**
 * פעולה formatTime: עיצוב ערך לתצוגה עבור זמן.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatTime(value: string): string {
  return value.slice(0, 5);
}


/**
 * פעולה modeTitle: מצב פעולה / כותרת.
 * @param workMode — מצב פעולה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function modeTitle(workMode: MyDynamicSchedulePeriod['workMode'] | MyDynamicScheduleWorkspace['workMode']): string {
  return workMode === 'shifts' ? 'המשמרות שלי' : 'הכוננויות שלי';
}

/**
 * פעולה changeModeText: מצב פעולה.
 * @param mode — מצב פעולה.
 * @returns string | null — הפלט בהתאם לחתימה.
 */
function changeModeText(mode: MyDynamicScheduleWorkspace['scheduleChangeMode']): string | null {
  if (mode === 'shift_exchange') return 'לתפקיד הזה פעילה מערכת חילופי משמרות. ניתן להגיש בקשה בלחיצה על משמרת אישית בלוח השנה או דרך טאב „חילופי משמרות”.';
  return null;
}

/**
 * פעולה MyDynamicShiftsPage: דינמי / משמרות.
 */
function MyDynamicShiftsPage() {
  // מצב מקומי: periods — תקופות; setPeriods מעדכנת אותו ומפעילה רינדור לפי React.
  const [periods, setPeriods] = useState<MyDynamicSchedulePeriod[]>([]);
  // מצב מקומי: selectedId — נבחר / מזהה; setSelectedId מעדכנת אותו ומפעילה רינדור לפי React.
  const [selectedId, setSelectedId] = useState<string>('');
  // מצב מקומי: selectedJobTypeId — מזהה סוג התפקיד; setSelectedJobTypeId מעדכנת אותו ומפעילה רינדור לפי React.
  const [selectedJobTypeId, setSelectedJobTypeId] = useState<string>('');
  // מצב מקומי: workspace — הנתון workspace בהקשר הפעולה; setWorkspace מעדכנת אותו ומפעילה רינדור לפי React.
  const [workspace, setWorkspace] = useState<MyDynamicScheduleWorkspace | null>(null);
  // מצב מקומי: viewMode — מצב פעולה; setViewMode מעדכנת אותו ומפעילה רינדור לפי React.
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  // מצב מקומי: coverageConflicts — הנתון coverageConflicts בהקשר הפעולה; setCoverageConflicts מעדכנת אותו ומפעילה רינדור לפי React.
  const [coverageConflicts, setCoverageConflicts] = useState<MyOnCallCoverageConflict[]>([]);
  // מצב מקומי: coverageError — שגיאה; setCoverageError מעדכנת אותו ומפעילה רינדור לפי React.
  const [coverageError, setCoverageError] = useState(false);
  /**
   * פעולה refreshCoverage: רענון הנתון refreshCoverage בהקשר הפעולה.
   */
  const refreshCoverage = () => {
    void dynamicSchedulingService.getMyOnCallCoverageConflicts()
      .then((items) => { setCoverageConflicts(items); setCoverageError(false); })
      .catch(() => setCoverageError(true));
  };
  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(() => {
    refreshCoverage();
    window.addEventListener('gvk:dynamic-schedule-changed', refreshCoverage);
    window.addEventListener('focus', refreshCoverage);
    return () => {
      window.removeEventListener('gvk:dynamic-schedule-changed', refreshCoverage);
      window.removeEventListener('focus', refreshCoverage);
    };
  }, []);

  // מצב מקומי: holidays — חגים; setHolidays מעדכנת אותו ומפעילה רינדור לפי React.
  const [holidays, setHolidays] = useState<CalendarHoliday[]>([]);
  // מצב מקומי: loading — טעינה; setLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [loading, setLoading] = useState(true);
  // מצב מקומי: workspaceLoading — טעינה; setWorkspaceLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] = useState<string | null>(null);
  // מצב מקומי: selfEditOpen — הנתון selfEditOpen בהקשר הפעולה; setSelfEditOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [selfEditOpen, setSelfEditOpen] = useState(false);
  // מצב מקומי: selfEditWorkspace — הנתון selfEditWorkspace בהקשר הפעולה; setSelfEditWorkspace מעדכנת אותו ומפעילה רינדור לפי React.
  const [selfEditWorkspace, setSelfEditWorkspace] = useState<DynamicSelfEditWorkspace | null>(null);
  // מצב מקומי: selfEditLoading — טעינה; setSelfEditLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [selfEditLoading, setSelfEditLoading] = useState(false);
  // מצב מקומי: selfEditSavingId — שמירה / מזהה; setSelfEditSavingId מעדכנת אותו ומפעילה רינדור לפי React.
  const [selfEditSavingId, setSelfEditSavingId] = useState<string | null>(null);
  // מצב מקומי: selectedCalendarAssignmentId — נבחר / לוח שנה / הקצאה / מזהה; setSelectedCalendarAssignmentId מעדכנת אותו ומפעילה רינדור לפי React.
  const [selectedCalendarAssignmentId, setSelectedCalendarAssignmentId] = useState<string | null>(null);
  // מצב מקומי: exchangeFormOpen — הנתון exchangeFormOpen בהקשר הפעולה; setExchangeFormOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [exchangeFormOpen, setExchangeFormOpen] = useState(false);
  // מצב מקומי: exchangeOptions — אפשרויות בחירה; setExchangeOptions מעדכנת אותו ומפעילה רינדור לפי React.
  const [exchangeOptions, setExchangeOptions] = useState<DynamicShiftExchangeOptions | null>(null);
  // מצב מקומי: exchangeLoading — טעינה; setExchangeLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [exchangeLoading, setExchangeLoading] = useState(false);
  // מצב מקומי: exchangeSubmitting — הנתון exchangeSubmitting בהקשר הפעולה; setExchangeSubmitting מעדכנת אותו ומפעילה רינדור לפי React.
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false);
  // מצב מקומי: exchangeError — שגיאה; setExchangeError מעדכנת אותו ומפעילה רינדור לפי React.
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  // מצב מקומי: exchangeSuccess — הנתון exchangeSuccess בהקשר הפעולה; setExchangeSuccess מעדכנת אותו ומפעילה רינדור לפי React.
  const [exchangeSuccess, setExchangeSuccess] = useState(false);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [exchangeSuccess].
  useEffect(() => {
    if (!exchangeSuccess) return;
    // timeoutId — משך המתנה / מזהה.
    const timeoutId = window.setTimeout(() => setExchangeSuccess(false), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [exchangeSuccess]);
  // מצב מקומי: exchangeType — הנתון exchangeType בהקשר הפעולה; setExchangeType מעדכנת אותו ומפעילה רינדור לפי React.
  const [exchangeType, setExchangeType] = useState<DynamicShiftExchangeType>('one_way');
  // מצב מקומי: exchangeCounterpartyId — מזהה; setExchangeCounterpartyId מעדכנת אותו ומפעילה רינדור לפי React.
  const [exchangeCounterpartyId, setExchangeCounterpartyId] = useState('');
  // מצב מקומי: exchangeCounterpartyAssignmentId — הקצאה / מזהה; setExchangeCounterpartyAssignmentId מעדכנת אותו ומפעילה רינדור לפי React.
  const [exchangeCounterpartyAssignmentId, setExchangeCounterpartyAssignmentId] = useState('');
  // מצב מקומי: selectedAssigneeId — נבחר / מזהה; setSelectedAssigneeId מעדכנת אותו ומפעילה רינדור לפי React.
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('all');
  // מצב מקומי: selfEditPermissionState — הרשאות / מצב; setSelfEditPermissionState מעדכנת אותו ומפעילה רינדור לפי React.
  const [selfEditPermissionState, setSelfEditPermissionState] = useState({ canSelfEdit: false, canViewOthers: false, canEditAll: false });

  /**
   * פעולה אסינכרונית loadPeriods: טעינת תקופות.
   */
  const loadPeriods = async () => {
    setLoading(true);
    setError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // nextPeriods — תקופות.
      const nextPeriods = await dynamicSchedulingService.getMyDynamicSchedulePeriods();
      setPeriods(nextPeriods);
      setSelectedId((current) =>
        current && nextPeriods.some((period) => period.publicationId === current)
          ? current
          : nextPeriods[0]?.publicationId ?? '',
      );
      setSelectedJobTypeId((current) =>
        current && nextPeriods.some((period) => period.jobTypeId === current)
          ? current
          : nextPeriods[0]?.jobTypeId ?? '',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'טעינת המשמרות נכשלה.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * פעולה אסינכרונית loadSelfEditWorkspace: טעינת הנתון loadSelfEditWorkspace בהקשר הפעולה.
   * @param publicationId — מזהה.
   */
  const loadSelfEditWorkspace = async (publicationId: string) => {
    setSelfEditLoading(true);
    setError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // data — נתונים.
      const data = await dynamicSchedulingService.getMyDynamicSelfEditWorkspace(publicationId);
      setSelfEditWorkspace(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'טעינת עריכת השיבוץ נכשלה.');
      setSelfEditWorkspace(null);
    } finally {
      setSelfEditLoading(false);
    }
  };

  /**
   * פעולה אסינכרונית reloadPersonalWorkspace: הנתון reloadPersonalWorkspace בהקשר הפעולה.
   * @param publicationId — מזהה.
   */
  const reloadPersonalWorkspace = async (publicationId: string) => {
    // data — נתונים.
    const data = await dynamicSchedulingService.getMyDynamicScheduleWorkspace(publicationId);
    setWorkspace(data);
  };

  /**
   * פעולה אסינכרונית handleSelfEditAssignment: טיפול באירוע עבור הקצאה.
   * @param assignmentId — הקצאה / מזהה.
   * @param userId — מזהה משתמש.
   */
  const handleSelfEditAssignment = async (assignmentId: string, userId: string) => {
    if (!selectedId) return;
    setSelfEditSavingId(assignmentId);
    setError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await dynamicSchedulingService.updateMyDynamicPublishedAssignment(selectedId, assignmentId, userId);
      await Promise.all([
        loadSelfEditWorkspace(selectedId),
        reloadPersonalWorkspace(selectedId),
        loadPeriods(),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'עדכון השיבוץ נכשל.');
    } finally {
      setSelfEditSavingId(null);
    }
  };

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(() => {
    void loadPeriods();
  }, []);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [selectedId].
  useEffect(() => {
    setSelfEditOpen(false);
    setSelfEditWorkspace(null);
    setSelectedCalendarAssignmentId(null);
    setSelectedAssigneeId('all');
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !selectedId.
    if (!selectedId) {
      setWorkspace(null);
      return;
    }

    // active — פעיל.
    let active = true;
    setWorkspaceLoading(true);
    setError(null);
    void dynamicSchedulingService.getMyDynamicScheduleWorkspace(selectedId)
      .then((data) => {
        if (active) setWorkspace(data);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'טעינת הלוח נכשלה.');
      })
      .finally(() => {
        if (active) setWorkspaceLoading(false);
      });
    return () => { active = false; };
  }, [selectedId]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [selectedId].
  useEffect(() => {
    if (!selectedId) return;
    // active — פעיל.
    let active = true;
    /**
     * פעולה refreshPublishedSchedule: רענון פורסם / שיבוץ.
     */
    const refreshPublishedSchedule = () => {
      if (!active || document.visibilityState === 'hidden') return;
      void dynamicSchedulingService.getMyDynamicScheduleWorkspace(selectedId)
        .then((data) => { if (active) setWorkspace(data); })
        .catch((caught: unknown) => {
          if (active) setError(caught instanceof Error ? caught.message : 'רענון השיבוץ נכשל.');
        });
    };
    /**
     * פעולה onVisibilityChange: הנתון onVisibilityChange בהקשר הפעולה.
     */
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshPublishedSchedule();
    };
    window.addEventListener('focus', refreshPublishedSchedule);
    window.addEventListener('gvk:dynamic-schedule-changed', refreshPublishedSchedule);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshPublishedSchedule);
      window.removeEventListener('gvk:dynamic-schedule-changed', refreshPublishedSchedule);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [selectedId]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [workspace?.jobTypeId, workspace?.periodSource, workspace?.scheduleChangeMode].
  useEffect(() => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !workspace || workspace.periodSource !== 'publication' || workspace.scheduleChangeMode !== 'self_edit'.
    if (!workspace || workspace.periodSource !== 'publication' || workspace.scheduleChangeMode !== 'self_edit') {
      setSelfEditPermissionState({ canSelfEdit: false, canViewOthers: false, canEditAll: false });
      return;
    }

    // active — פעיל.
    let active = true;
    void Promise.all([
      dynamicSchedulingService.hasMyDynamicJobTypePermission('schedule.self_edit', workspace.jobTypeId),
      dynamicSchedulingService.hasMyDynamicJobTypePermission('schedule.view_others', workspace.jobTypeId),
      dynamicSchedulingService.hasMyDynamicJobTypePermission('schedule.edit_all', workspace.jobTypeId),
    ]).then(([canSelfEdit, canViewOthers, canEditAll]) => {
      if (active) setSelfEditPermissionState({ canSelfEdit, canViewOthers, canEditAll });
    }).catch(() => {
      if (active) setSelfEditPermissionState({ canSelfEdit: false, canViewOthers: false, canEditAll: false });
    });

    return () => { active = false; };
  }, [workspace?.jobTypeId, workspace?.periodSource, workspace?.scheduleChangeMode]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [workspace?.year, workspace?.month].
  useEffect(() => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !workspace.
    if (!workspace) {
      setHolidays([]);
      return;
    }

    // active — פעיל.
    let active = true;
    void calendarHolidayService.getCalendarHolidays(workspace.year, workspace.month)
      .then((items) => {
        if (active) setHolidays(items);
      })
      .catch(() => {
        if (active) setHolidays([]);
      });

    return () => { active = false; };
  }, [workspace?.year, workspace?.month]);

  // ערך מחושב holidayLabels — חג; נשמר בין רינדורים עד שינוי התלויות.
  const holidayLabels = useMemo(() => {
    const labels = new Map<string, string[]>();
    holidays.forEach((holiday) => {
      // current — הנתון current בהקשר הפעולה.
      const current = labels.get(holiday.date) ?? [];
      if (!current.includes(holiday.name)) current.push(holiday.name);
      labels.set(holiday.date, current);
    });
    return labels;
  }, [holidays]);

  // ערך מחושב availableRoles — הנתון availableRoles בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const availableRoles = useMemo(() => {
    // byId — מזהה; מיפוי לחיפוש לפי מפתח.
    const byId = new Map<string, MyDynamicSchedulePeriod>();
    // עיבוד כל פריט מתוך periods בנפרד.
    for (const period of periods) {
      if (!byId.has(period.jobTypeId)) byId.set(period.jobTypeId, period);
    }
    return [...byId.values()].sort((first, second) => first.jobTypeName.localeCompare(second.jobTypeName, 'he'));
  }, [periods]);

  // ערך מחושב rolePeriods — תקופות; נשמר בין רינדורים עד שינוי התלויות.
  const rolePeriods = useMemo(
    () => periods
      .filter((period) => period.jobTypeId === selectedJobTypeId)
      .sort((first, second) => (first.year * 12 + first.month) - (second.year * 12 + second.month)),
    [periods, selectedJobTypeId],
  );

  // selectedRolePeriodIndex — נבחר / תקופה / מיקום באוסף.
  const selectedRolePeriodIndex = rolePeriods.findIndex((period) => period.publicationId === selectedId);
  // previousPeriod — תקופה.
  const previousPeriod = selectedRolePeriodIndex > 0 ? rolePeriods[selectedRolePeriodIndex - 1] : null;
  // nextPeriod — תקופה.
  const nextPeriod = selectedRolePeriodIndex >= 0 && selectedRolePeriodIndex < rolePeriods.length - 1
    ? rolePeriods[selectedRolePeriodIndex + 1]
    : null;

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [rolePeriods, selectedId, selectedJobTypeId].
  useEffect(() => {
    if (!selectedJobTypeId) return;
    // selectedStillBelongsToRole — נבחר.
    const selectedStillBelongsToRole = rolePeriods.some((period) => period.publicationId === selectedId);
    if (!selectedStillBelongsToRole) {
      const latest = rolePeriods[rolePeriods.length - 1];
      setSelectedId(latest?.publicationId ?? '');
    }
  }, [rolePeriods, selectedId, selectedJobTypeId]);

  // selectedPeriod — נבחר / תקופה.
  const selectedPeriod = periods.find((period) => period.publicationId === selectedId) ?? null;
  // pageTitle — כותרת.
  const pageTitle = workspace
    ? modeTitle(workspace.workMode)
    : selectedPeriod
      ? modeTitle(selectedPeriod.workMode)
      : 'המשמרות שלי';

  // ערך מחושב visibleAssignees — הנתון visibleAssignees בהקשר הפעולה; נשמר בין רינדורים עד שינוי התלויות.
  const visibleAssignees = useMemo(() => {
    if (!workspace?.canViewOthers) return [];
    // byId — מזהה; מיפוי לחיפוש לפי מפתח.
    const byId = new Map<string, string>();
    // עיבוד כל פריט מתוך workspace.assignments בנפרד.
    for (const assignment of workspace.assignments) {
      if (assignment.userId && assignment.displayName && !byId.has(assignment.userId)) {
        byId.set(assignment.userId, assignment.displayName);
      }
    }
    return [...byId.entries()]
      .map(([userId, displayName]) => ({ userId, displayName }))
      .sort((first, second) => first.displayName.localeCompare(second.displayName, 'he'));
  }, [workspace]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [selectedAssigneeId, visibleAssignees].
  useEffect(() => {
    if (selectedAssigneeId !== 'all' && !visibleAssignees.some((assignee) => assignee.userId === selectedAssigneeId)) {
      setSelectedAssigneeId('all');
    }
  }, [selectedAssigneeId, visibleAssignees]);

  // ערך מחושב visibleAssignments — הקצאות; נשמר בין רינדורים עד שינוי התלויות.
  const visibleAssignments = useMemo(() => {
    // assignments — הקצאות.
    const assignments = workspace?.assignments ?? [];
    if (!workspace?.canViewOthers || selectedAssigneeId === 'all') return assignments;
    return assignments.filter((assignment) => assignment.userId === selectedAssigneeId);
  }, [selectedAssigneeId, workspace]);

  // ערך מחושב assignmentsByDate — הקצאות / תאריך; נשמר בין רינדורים עד שינוי התלויות.
  const assignmentsByDate = useMemo(() => {
    // map — מפת התאמה; מיפוי לחיפוש לפי מפתח.
    const map = new Map<string, MyDynamicScheduleAssignment[]>();
    // עיבוד כל פריט מתוך visibleAssignments בנפרד.
    for (const assignment of visibleAssignments) {
      // current — הנתון current בהקשר הפעולה.
      const current = map.get(assignment.shiftDate) ?? [];
      current.push(assignment);
      map.set(assignment.shiftDate, current);
    }
    return map;
  }, [visibleAssignments]);

  // ערך מחושב groupedDates — תאריכים; נשמר בין רינדורים עד שינוי התלויות.
  const groupedDates = useMemo(
    () => [...assignmentsByDate.entries()].sort(([first], [second]) => first.localeCompare(second)),
    [assignmentsByDate],
  );

  // ערך מחושב selfEditGroupedDates — תאריכים; נשמר בין רינדורים עד שינוי התלויות.
  const selfEditGroupedDates = useMemo(() => {
    // map — מפת התאמה; מיפוי לחיפוש לפי מפתח.
    const map = new Map<string, DynamicSelfEditWorkspace['assignments']>();
    // עיבוד כל פריט מתוך selfEditWorkspace?.assignments ?? [] בנפרד.
    for (const assignment of selfEditWorkspace?.assignments ?? []) {
      // current — הנתון current בהקשר הפעולה.
      const current = map.get(assignment.shiftDate) ?? [];
      current.push(assignment);
      map.set(assignment.shiftDate, current);
    }
    return [...map.entries()].sort(([first], [second]) => first.localeCompare(second));
  }, [selfEditWorkspace]);

  // ערך מחושב selectedCalendarAssignment — נבחר / לוח שנה / הקצאה; נשמר בין רינדורים עד שינוי התלויות.
  const selectedCalendarAssignment = useMemo(
    () => workspace?.assignments.find((assignment) => assignment.id === selectedCalendarAssignmentId) ?? null,
    [workspace, selectedCalendarAssignmentId],
  );

  // ערך מחושב selectedCalendarEditorAssignment — נבחר / לוח שנה / הקצאה; נשמר בין רינדורים עד שינוי התלויות.
  const selectedCalendarEditorAssignment = useMemo(
    () => selfEditWorkspace?.assignments.find((assignment) => assignment.id === selectedCalendarAssignmentId) ?? null,
    [selfEditWorkspace, selectedCalendarAssignmentId],
  );

  // ערך מחושב conflictAssignmentIds — הקצאה; נשמר בין רינדורים עד שינוי התלויות.
  const conflictAssignmentIds = useMemo(() => new Set(
    coverageConflicts.filter((item) => item.publicationId === workspace?.publicationId).map((item) => item.assignmentId),
  ), [coverageConflicts, workspace?.publicationId]);

  /**
   * פעולה canEditAssignment: בדיקת אפשרות פעולה עבור האם עריכה מותרת.
   * @param assignment — הקצאה.
   * @returns boolean — הפלט בהתאם לחתימה.
   */
  const canEditAssignment = (assignment: MyDynamicScheduleAssignment): boolean => {
    if (!workspace || workspace.readOnly || workspace.scheduleChangeMode !== 'self_edit') return false;
    if (selfEditPermissionState.canEditAll) return true;
    return assignment.isMine && selfEditPermissionState.canSelfEdit;
  };

  /**
   * פעולה canRequestExchange: בדיקת אפשרות פעולה עבור נתוני הבקשה.
   * @param assignment — הקצאה.
   * @returns boolean — הפלט בהתאם לחתימה.
   */
  const canRequestExchange = (assignment: MyDynamicScheduleAssignment): boolean =>
    Boolean(workspace && !workspace.readOnly && workspace.scheduleChangeMode === 'shift_exchange' && assignment.isMine);

  /**
   * פעולה closeCalendarModal: סגירת לוח שנה.
   */
  const closeCalendarModal = () => {
    if (exchangeSubmitting) return;
    setSelectedCalendarAssignmentId(null);
    setExchangeFormOpen(false);
    setExchangeError(null);
  };

  /**
   * פעולה אסינכרונית openExchangeForm: פתיחת הנתון openExchangeForm בהקשר הפעולה.
   */
  const openExchangeForm = async () => {
    if (!selectedCalendarAssignment) return;
    // assignmentId — הקצאה / מזהה.
    const assignmentId = selectedCalendarAssignment.id;
    setExchangeFormOpen(true);
    setExchangeLoading(true);
    setExchangeError(null);
    setExchangeOptions(null);
    setExchangeType('one_way');
    setExchangeCounterpartyId('');
    setExchangeCounterpartyAssignmentId('');
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // options — אפשרויות בחירה.
      const options = await dynamicSchedulingService.getMyDynamicShiftExchangeOptions();
      if (!options.myShifts.some((shift) => shift.id === assignmentId)) {
        setExchangeError('המשמרת כבר אינה זמינה להגשת בקשת חילוף.');
      } else {
        setExchangeOptions(options);
      }
    } catch (caught) {
      setExchangeError(caught instanceof Error ? caught.message : 'טעינת אפשרויות החילוף נכשלה.');
    } finally {
      setExchangeLoading(false);
    }
  };

  /**
   * פעולה אסינכרונית submitCalendarExchange: הגשת לוח שנה.
   */
  const submitCalendarExchange = async () => {
    if (!selectedCalendarAssignment || !exchangeOptions || !exchangeCounterpartyId || exchangeSubmitting) return;
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר exchangeType === 'two_way' && !exchangeCounterpartyAssignmentId.
    if (exchangeType === 'two_way' && !exchangeCounterpartyAssignmentId) {
      setExchangeError('יש לבחור משמרת נגדית.');
      return;
    }
    setExchangeSubmitting(true);
    setExchangeError(null);
    setExchangeSuccess(false);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await dynamicSchedulingService.createDynamicShiftExchangeRequest({
        swapType: exchangeType,
        requesterAssignmentId: selectedCalendarAssignment.id,
        counterpartyUserId: exchangeCounterpartyId,
        counterpartyAssignmentId: exchangeType === 'two_way' ? exchangeCounterpartyAssignmentId : null,
      });
      setSelectedCalendarAssignmentId(null);
      setExchangeFormOpen(false);
      setExchangeOptions(null);
      setExchangeSuccess(true);
      refreshCoverage();
      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await reloadPersonalWorkspace(selectedId);
        refreshCoverage();
      } catch {
        // The request was already created successfully; a refresh failure must not report a failed submission.
      }
    } catch (caught) {
      setExchangeError(caught instanceof Error ? caught.message : 'שליחת בקשת החילוף נכשלה.');
    } finally {
      setExchangeSubmitting(false);
    }
  };

  // selectedExchangeShift — נבחר / משמרת.
  const selectedExchangeShift = exchangeOptions?.myShifts.find((shift) => shift.id === selectedCalendarAssignmentId);
  // exchangeMembers — חברי התפקיד.
  const exchangeMembers = exchangeOptions?.members.filter((member) => member.jobTypeId === selectedExchangeShift?.jobTypeId) ?? [];
  // exchangeCounterpartyShifts — משמרות.
  const exchangeCounterpartyShifts = exchangeOptions?.counterpartyShifts.filter((shift) =>
    shift.publicationId === selectedExchangeShift?.publicationId && shift.assignedUserId === exchangeCounterpartyId
  ) ?? [];

  /**
   * פעולה openCalendarAssignmentEditor: פתיחת לוח שנה / הקצאה.
   * @param assignment — הקצאה.
   */
  const openCalendarAssignmentEditor = (assignment: MyDynamicScheduleAssignment) => {
    if (!canEditAssignment(assignment) && !canRequestExchange(assignment)) return;
    setExchangeSuccess(false);
    setSelectedCalendarAssignmentId(assignment.id);
    if (canEditAssignment(assignment) && (!selfEditWorkspace || selfEditWorkspace.publicationId !== workspace?.publicationId)) {
      void loadSelfEditWorkspace(workspace!.publicationId);
    }
  };

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר loading.
  if (loading) {
    return <main className="my-dynamic-shifts page-shell" dir="rtl"><div className="my-shifts-loading"><LoaderCircle className="spin" /> טוען לוחות שפורסמו…</div></main>;
  }

  return (
    <main className="my-dynamic-shifts page-shell" dir="rtl">
      <header className="my-shifts-header">
        <div>
          <h1><CalendarDays size={27} /> {pageTitle}</h1>
          <p>הלוחות כאן כוללים פרסומים דינמיים וגם היסטוריה שיובאה מחודשים קודמים.</p>
        </div>
        <Button variant="secondary" onClick={() => void loadPeriods()}><RefreshCw size={16} /> רענן</Button>
      </header>

      {error ? <div className="users-error" role="alert">{error}</div> : null}
      {exchangeSuccess ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: 'max-content',
            maxWidth: 'calc(100vw - 32px)',
            padding: '14px 18px',
            borderRadius: 14,
            border: '1px solid #86d6a3',
            background: '#edfdf2',
            color: '#14532d',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.2)',
          }}
        >
          <CheckCircle2 size={24} aria-hidden="true" />
          <div>
            <strong>בקשת החילוף נשלחה בהצלחה!</strong>
            <div>הבקשה ממתינה לאישור העובד המחליף.</div>
          </div>
          <button
            type="button"
            onClick={() => setExchangeSuccess(false)}
            aria-label="סגור הודעת הצלחה"
            style={{ marginInlineStart: 'auto', border: 0, background: 'transparent', cursor: 'pointer', color: 'inherit' }}
          ><X size={18} /></button>
        </div>
      ) : null}

      {!periods.length ? (
        <section className="my-shifts-empty">
          <CalendarDays size={34} />
          <h2>אין עדיין לוח דינמי שפורסם עבורך</h2>
          <p>לא נמצאו עבורך לוחות שפורסמו או חודשים היסטוריים שיובאו לתפקידים הדינמיים שלך.</p>
        </section>
      ) : (
        <>
          <section className="my-shifts-period-controls" aria-label="בחירת תפקיד וחודש">
            <label>
              <span>תפקיד</span>
              <select
                value={selectedJobTypeId}
                onChange={(event) => setSelectedJobTypeId(event.target.value)}
              >
                {availableRoles.map((period) => (
                  <option key={period.jobTypeId} value={period.jobTypeId}>{period.jobTypeName}</option>
                ))}
              </select>
            </label>

            <div className="my-shifts-month-navigation">
              <button
                type="button"
                className="my-shifts-month-arrow"
                disabled={!previousPeriod}
                onClick={() => previousPeriod && setSelectedId(previousPeriod.publicationId)}
                aria-label="חודש קודם"
                title={previousPeriod ? 'חודש קודם' : 'אין חודש קודם זמין'}
              >
                <ChevronRight size={18} />
              </button>

              <label>
                <span>חודש</span>
                <select
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {rolePeriods.map((period) => (
                    <option key={period.publicationId} value={period.publicationId}>
                      {String(period.month).padStart(2, '0')}/{period.year}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="my-shifts-month-arrow"
                disabled={!nextPeriod}
                onClick={() => nextPeriod && setSelectedId(nextPeriod.publicationId)}
                aria-label="חודש הבא"
                title={nextPeriod ? 'חודש הבא' : 'אין חודש הבא זמין'}
              >
                <ChevronLeft size={18} />
              </button>
            </div>

            <div className="my-shifts-period-meta">
              {selectedPeriod ? (
                <>
                  <strong>{selectedPeriod.jobTypeName}</strong>
                  <span dir="ltr">{String(selectedPeriod.month).padStart(2, '0')}/{selectedPeriod.year}</span>
                  <small>{selectedPeriod.assignmentCount} {selectedPeriod.workMode === 'shifts' ? 'משמרות' : 'כוננויות'} · {selectedPeriod.periodSource === 'history' ? 'היסטוריה מיובאת' : 'לוח שפורסם'}</small>
                </>
              ) : null}
            </div>
          </section>

          {workspaceLoading ? (
            <section className="my-shifts-loading"><LoaderCircle className="spin" /> טוען לוח…</section>
          ) : workspace ? (
            <section className="my-shifts-card">
              <div className="my-shifts-toolbar">
                <div className="my-shifts-summary">
                  <span className={workspace.periodSource === 'history' ? 'my-shifts-history' : 'my-shifts-published'}><CheckCircle2 size={16} /> {workspace.periodSource === 'history' ? 'היסטוריה מיובאת' : 'פורסם'}</span>
                  <strong>{visibleAssignments.length}</strong>
                  <span>{workspace.canViewOthers
                    ? (workspace.workMode === 'shifts' ? 'משמרות התפקיד בחודש' : 'כוננויות התפקיד בחודש')
                    : (workspace.workMode === 'shifts' ? 'המשמרות שלי בחודש' : 'הכוננויות שלי בחודש')}</span>
                </div>
                <div className="my-shifts-view-toggle" role="group" aria-label="תצוגת לוח">
                  <button type="button" className={viewMode === 'calendar' ? 'is-active' : ''} onClick={() => setViewMode('calendar')}><CalendarDays size={16} /> טבלה חודשית</button>
                  <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')}><List size={16} /> רשימה</button>
                </div>
              </div>

              {workspace.canViewOthers ? (
                <div className="my-shifts-assignee-filter">
                  <label>
                    <span>סינון לפי עובד</span>
                    <select value={selectedAssigneeId} onChange={(event) => setSelectedAssigneeId(event.target.value)}>
                      <option value="all">כל העובדים</option>
                      {visibleAssignees.map((assignee) => (
                        <option key={assignee.userId} value={assignee.userId}>{assignee.displayName}</option>
                      ))}
                    </select>
                  </label>
                  <small>הסינון משפיע גם על הטבלה החודשית וגם על תצוגת הרשימה.</small>
                </div>
              ) : null}

              {viewMode === 'list'
                && !workspace.readOnly
                && workspace.scheduleChangeMode === 'self_edit'
                && (selfEditPermissionState.canSelfEdit || selfEditPermissionState.canEditAll)
                && (workspace.assignments.length > 0 || selfEditPermissionState.canViewOthers || selfEditPermissionState.canEditAll) ? (
                <div className="my-shifts-self-edit-entry">
                  <div>
                    <strong>שינוי שיבוץ עצמי פעיל לתפקיד הזה</strong>
                    <span>ניתן לפתוח את הלוח המלא של התפקיד ולשנות את העובד המשובץ, בהתאם לחלון העריכה.</span>
                  </div>
                  <Button
                    variant={selfEditOpen ? 'secondary' : 'primary'}
                    onClick={() => {
                      // nextOpen — הנתון nextOpen בהקשר הפעולה.
                      const nextOpen = !selfEditOpen;
                      setSelfEditOpen(nextOpen);
                      if (nextOpen && !selfEditWorkspace) void loadSelfEditWorkspace(workspace.publicationId);
                    }}
                  >
                    {selfEditOpen ? <><X size={16} /> סגור עריכה</> : <><Pencil size={16} /> ערוך שיבוץ</>}
                  </Button>
                </div>
              ) : null}

              {coverageError && workspace.scheduleChangeMode === 'shift_exchange' ? (
                <div className="my-shifts-coverage-load-error" role="status">לא ניתן כרגע לבדוק אילו כוננויות דורשות חלופה. נסה לרענן את הדף.</div>
              ) : null}
              {coverageConflicts.some((item) => item.publicationId === workspace.publicationId) ? (
                <div className="my-shifts-coverage-summary" role="alert">
                  <AlertTriangle size={20} aria-hidden="true" />
                  <div><strong>נדרשת מציאת חלופה לכוננויות שסימנת בהן ״לא זמין״</strong>
                    <span>הסבב נשמר. עליך לשלוח בקשת חילוף ולקבל את אישור המחליף.</span>
                    <div className="my-shifts-coverage-dates">{coverageConflicts.filter((item) => item.publicationId === workspace.publicationId).map((item) => <span key={item.assignmentId}>{formatDate(item.shiftDate)}</span>)}</div>
                  </div>
                </div>
              ) : null}

              {workspace.readOnly ? (
                <div className="my-shifts-transition-note">זהו חודש היסטורי שיובא מהמערכת הקודמת ולכן הוא מוצג לקריאה בלבד.</div>
              ) : changeModeText(workspace.scheduleChangeMode) ? (
                <div className="my-shifts-transition-note">{changeModeText(workspace.scheduleChangeMode)}</div>
              ) : null}

              {selfEditOpen ? (
                <section className="my-shifts-self-edit-panel" aria-label="עריכת שיבוץ עצמי">
                  <header>
                    <div>
                      <h2>עריכת שיבוץ</h2>
                      <p>זהו הלוח המלא של התפקיד. שינוי נשמר מיד ומתועד ביומן המערכת.</p>
                    </div>
                    {selfEditWorkspace ? (
                      <span className={selfEditWorkspace.editable ? 'is-editable' : 'is-locked'}>
                        {selfEditWorkspace.editable ? 'פתוח לעריכה' : 'קריאה בלבד'}
                      </span>
                    ) : null}
                  </header>

                  {selfEditLoading ? (
                    <div className="my-shifts-loading"><LoaderCircle className="spin" /> טוען לוח לעריכה…</div>
                  ) : selfEditWorkspace ? (
                    <>
                      {!selfEditWorkspace.editable && selfEditWorkspace.editabilityReason ? (
                        <div className="my-shifts-self-edit-warning">{selfEditWorkspace.editabilityReason}</div>
                      ) : null}
                      <div className="my-shifts-transition-note">
                        {selfEditWorkspace.canViewOthers
                          ? 'מוצג הלוח המלא של התפקיד, כולל משמרות/כוננויות של עובדים אחרים.'
                          : 'מוצגים רק השיבוצים שלך. הרשאת „הצגת משמרות/כוננויות של משתמשים אחרים” כבויה לתפקיד הזה.'}
                      </div>
                      <div className="my-shifts-self-edit-list">
                        {selfEditGroupedDates.map(([date, assignments]) => {
                          // dateObject — תאריך.
                          const dateObject = localDate(date);
                          return (
                            <section key={date} className="my-shifts-self-edit-day">
                              <header>
                                <strong>{weekdays[dateObject.getDay()]}</strong>
                                <span dir="ltr">{formatDate(date)}</span>
                              </header>
                              <div>
                                {assignments.map((assignment) => (
                                  <article key={assignment.id} className={assignment.isMine ? 'is-mine' : ''}>
                                    <div className="my-shifts-self-edit-shift">
                                      <strong>{dynamicShiftDisplayName(assignment.shiftName, workspace?.workMode === 'on_call_daily' ? 'כוננות' : 'משמרת')}</strong>
                                      <span dir="ltr">{formatTime(assignment.startTime)}–{formatTime(assignment.endTime)}</span>
                                    </div>
                                    <label>
                                      <span>משובץ</span>
                                      <select
                                        value={assignment.userId}
                                        disabled={!selfEditWorkspace.editable || (!assignment.isMine && !selfEditWorkspace.canEditAll) || selfEditSavingId === assignment.id}
                                        onChange={(event) => void handleSelfEditAssignment(assignment.id, event.target.value)}
                                      >
                                        {assignment.candidates.map((candidate) => (
                                          <option key={candidate.userId} value={candidate.userId}>
                                            {selfEditCandidateLabel(candidate.displayName, candidate.availabilityStatus)}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    {selfEditSavingId === assignment.id ? <LoaderCircle className="spin" size={17} /> : null}
                                  </article>
                                ))}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </section>
              ) : null}

              {!visibleAssignments.length ? (
                <div className="my-shifts-no-assignments">
                  {workspace.canViewOthers
                    ? 'הלוח פורסם, אך אין שיבוצים להצגה לתפקיד בחודש זה.'
                    : `הלוח פורסם, אך לא שובצת ${workspace.workMode === 'shifts' ? 'למשמרות' : 'לכוננויות'} בחודש זה.`}
                </div>
              ) : viewMode === 'calendar' ? (
                <MonthCalendar
                  year={workspace.year}
                  month={workspace.month}
                  emptyMessage="אין משמרות להצגה בחודש הזה."
                  dayLabels={holidayLabels}
                  getDayClassName={({ date }) => (assignmentsByDate.get(date) ?? []).some((assignment) => conflictAssignmentIds.has(assignment.id)) ? 'my-shifts-calendar-needs-coverage' : assignmentsByDate.has(date) ? 'my-shifts-calendar-has-assignment' : null}
                  renderDayContent={({ date }) => {
                    // dayAssignments — יום / הקצאות.
                    const dayAssignments = assignmentsByDate.get(date) ?? [];
                    if (!dayAssignments.length) return null;
                    return (
                      <div className="my-shifts-calendar-items">
                        {dayAssignments.map((assignment) => {
                          const editable = canEditAssignment(assignment) || canRequestExchange(assignment);
                          return (
                            <button
                              key={assignment.id}
                              type="button"
                              className={`my-shifts-calendar-item${editable ? ' is-editable' : ''}${conflictAssignmentIds.has(assignment.id) ? ' needs-coverage' : ''}`}
                              onClick={() => openCalendarAssignmentEditor(assignment)}
                              disabled={!editable}
                              title={editable ? (canRequestExchange(assignment) ? 'לחץ להגשת בקשת חילוף' : 'לחץ לעריכת השיבוץ') : undefined}
                            >
                              <div className="my-shifts-assignment-title">
                                <strong>{dynamicShiftDisplayName(assignment.shiftName, workspace?.workMode === 'on_call_daily' ? 'כוננות' : 'משמרת')}</strong>
                                {assignment.contains200Percent ? <span className="my-shifts-premium-badge">200%</span> : null}
                              </div>
                              {conflictAssignmentIds.has(assignment.id) && canRequestExchange(assignment) ? (
                                <span className="my-shifts-coverage-action" aria-hidden="true">בקש חילוף</span>
                              ) : null}
                              <span className="my-shifts-time" dir="ltr">{formatTime(assignment.startTime)}–{formatTime(assignment.endTime)}</span>
                              {workspace.canViewOthers && assignment.displayName ? (
                                <small className="my-shifts-assignee">{assignment.displayName}{assignment.isMine ? ' · אני' : ''}</small>
                              ) : null}
                              {assignment.holidayName ? <small className="my-shifts-holiday-note">{assignment.holidayName}</small> : null}
                              {conflictAssignmentIds.has(assignment.id) ? <small className="my-shifts-coverage-label"><AlertTriangle size={13} /> לא זמין — נדרש חילוף</small> : null}
                            </button>
                          );
                        })}
                      </div>
                    );
                  }}
                />
              ) : (
                <div className="my-shifts-list">
                  {groupedDates.map(([date, dayAssignments]) => {
                    // dateObject — תאריך.
                    const dateObject = localDate(date);
                    return (
                      <section key={date} className="my-shifts-day-group">
                        <header>
                          <strong>{weekdays[dateObject.getDay()]}</strong>
                          <span className="my-shifts-date" dir="ltr">{formatDate(date)}</span>
                        </header>
                        <div>
                          {dayAssignments.map((assignment) => (
                            <article key={assignment.id} className={`my-shifts-row${conflictAssignmentIds.has(assignment.id) ? ' needs-coverage' : ''}`}>
                              <div>
                                <div className="my-shifts-assignment-title">
                                  <strong>{dynamicShiftDisplayName(assignment.shiftName, workspace?.workMode === 'on_call_daily' ? 'כוננות' : 'משמרת')}</strong>
                                  {assignment.contains200Percent ? <span className="my-shifts-premium-badge">200%</span> : null}
                                </div>
                                {workspace.canViewOthers && assignment.displayName ? (
                                  <small className="my-shifts-assignee">משובץ: {assignment.displayName}{assignment.isMine ? ' · אני' : ''}</small>
                                ) : null}
                                {assignment.holidayName ? <small className="my-shifts-holiday-note">{assignment.holidayName}</small> : null}
                                {assignment.managerEdited ? <small>השיבוץ עודכן ידנית על ידי מנהל</small> : null}
                                {conflictAssignmentIds.has(assignment.id) ? <small className="my-shifts-coverage-label"><AlertTriangle size={14} /> לא זמין — עליך למצוא מחליף</small> : null}
                              </div>
                              {conflictAssignmentIds.has(assignment.id) && canRequestExchange(assignment) ? (
                                <button type="button" className="my-shifts-coverage-action" onClick={() => openCalendarAssignmentEditor(assignment)}>בקש חילוף</button>
                              ) : null}
                              <span className="my-shifts-time" dir="ltr">{formatTime(assignment.startTime)}–{formatTime(assignment.endTime)}</span>
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}
        </>
      )}

      <Modal
        isOpen={Boolean(selectedCalendarAssignmentId)}
        title={selectedCalendarAssignment ? `${canRequestExchange(selectedCalendarAssignment) ? 'פרטי' : 'עריכת'} ${workspace?.workMode === 'shifts' ? 'משמרת' : 'כוננות'} · ${selectedCalendarAssignment.shiftName}` : 'פרטי שיבוץ'}
        onClose={closeCalendarModal}
        footer={<Button variant="secondary" onClick={closeCalendarModal} disabled={exchangeSubmitting}>סגור</Button>}
        className="my-shifts-calendar-edit-modal"
      >
        {selectedCalendarAssignment ? (
          <div className="my-shifts-calendar-edit-content">
            <div className="my-shifts-calendar-edit-meta">
              <span><strong>תאריך:</strong> <bdi dir="ltr">{formatDate(selectedCalendarAssignment.shiftDate)}</bdi></span>
              <span><strong>שעות:</strong> <bdi dir="ltr">{formatTime(selectedCalendarAssignment.startTime)}–{formatTime(selectedCalendarAssignment.endTime)}</bdi></span>
              {selectedCalendarAssignment.holidayName ? <span><strong>מועד:</strong> {selectedCalendarAssignment.holidayName}</span> : null}
            </div>

            {canRequestExchange(selectedCalendarAssignment) ? (
              exchangeFormOpen ? (
                <div className="my-shifts-inline-exchange" dir="rtl">
                  {exchangeLoading ? <div className="my-shifts-loading"><LoaderCircle className="spin" /> טוען אפשרויות חילוף…</div> : null}
                  {exchangeError ? <div className="users-error" role="alert">{exchangeError}</div> : null}
                  {exchangeOptions && selectedExchangeShift ? (
                    <>
                      <div className="my-shifts-exchange-types">
                        <button type="button" className={exchangeType === 'one_way' ? 'active' : ''} onClick={() => { setExchangeType('one_way'); setExchangeCounterpartyAssignmentId(''); }}>חד-כיווני</button>
                        <button type="button" className={exchangeType === 'two_way' ? 'active' : ''} onClick={() => setExchangeType('two_way')}>דו-כיווני</button>
                      </div>
                      <label><span>המשמרת שלי</span><strong>{formatDate(selectedCalendarAssignment.shiftDate)} · {selectedCalendarAssignment.shiftName}</strong></label>
                      <label><span>עובד מחליף</span>
                        <select value={exchangeCounterpartyId} onChange={(event) => { setExchangeCounterpartyId(event.target.value); setExchangeCounterpartyAssignmentId(''); }}>
                          <option value="">בחר עובד…</option>
                          {exchangeMembers.map((member) => <option key={member.userId} value={member.userId}>{member.displayName}</option>)}
                        </select>
                      </label>
                      {exchangeType === 'two_way' ? (
                        <label><span>המשמרת שלו/ה</span>
                          <select value={exchangeCounterpartyAssignmentId} disabled={!exchangeCounterpartyId} onChange={(event) => setExchangeCounterpartyAssignmentId(event.target.value)}>
                            <option value="">בחר משמרת נגדית…</option>
                            {exchangeCounterpartyShifts.map((shift) => <option key={shift.id} value={shift.id}>{formatDate(shift.shiftDate)} · {shift.shiftName} · {formatTime(shift.startTime)}–{formatTime(shift.endTime)}</option>)}
                          </select>
                        </label>
                      ) : null}
                      <p className="my-shifts-exchange-hint">הבקשה תישלח לאישור העובד השני בהתאם לכללי התפקיד.</p>
                      <Button onClick={() => void submitCalendarExchange()} disabled={exchangeSubmitting || !exchangeCounterpartyId || (exchangeType === 'two_way' && !exchangeCounterpartyAssignmentId)}>
                        {exchangeSubmitting ? 'שולח…' : 'שלח בקשת חילוף'}
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : (
                <Button onClick={() => void openExchangeForm()}>בקשה לחילוף משמרת</Button>
              )
            ) : selfEditLoading ? (
              <div className="my-shifts-loading"><LoaderCircle className="spin" /> טוען אפשרויות שיבוץ…</div>
            ) : selfEditWorkspace && selectedCalendarEditorAssignment ? (
              <label className="my-shifts-calendar-edit-select">
                <span>משובץ</span>
                <select
                  value={selectedCalendarEditorAssignment.userId}
                  disabled={!selfEditWorkspace.editable || (!selectedCalendarEditorAssignment.isMine && !selfEditWorkspace.canEditAll) || selfEditSavingId === selectedCalendarEditorAssignment.id}
                  onChange={(event) => void handleSelfEditAssignment(selectedCalendarEditorAssignment.id, event.target.value)}
                >
                  {selectedCalendarEditorAssignment.candidates.map((candidate) => (
                    <option key={candidate.userId} value={candidate.userId}>
                      {selfEditCandidateLabel(candidate.displayName, candidate.availabilityStatus)}
                    </option>
                  ))}
                </select>
                {selfEditSavingId === selectedCalendarEditorAssignment.id ? <small><LoaderCircle className="spin" size={15} /> שומר…</small> : null}
              </label>
            ) : (
              <div className="my-shifts-self-edit-warning">לא ניתן לטעון את פרטי העריכה של השיבוץ.</div>
            )}

            {selfEditWorkspace && !selfEditWorkspace.editable && selfEditWorkspace.editabilityReason ? (
              <div className="my-shifts-self-edit-warning">{selfEditWorkspace.editabilityReason}</div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </main>
  );
}

export default MyDynamicShiftsPage;
