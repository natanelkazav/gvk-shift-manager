/**
 * קובץ: src/components/settings/ScheduleExportPanel.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור שיבוץ / ייצוא.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ExportTarget, getMonthTarget, formatMonthLabel, readStoredLayout, persistLayout, getErrorMessage, getModeLabel, ScheduleExportPanel.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  CloudUpload,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  RotateCcw,
  Columns3,
  Save,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { scheduleExportLayoutSettingsService } from '../../services/scheduleExportLayoutSettingsService';
import { scheduleArchiveService } from '../../services/scheduleArchiveService';
import { dynamicScheduleExportService } from '../../services/dynamicScheduleExportService';
import type {
  ScheduleExcelLayout,
  ScheduleFileJobTypeOption,
} from '../../types/scheduleFileLayout';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Select,
} from '../ui';

// hebrewMonths — חודשים.
const hebrewMonths = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

/**
 * טיפוס ExportTarget: ייצוא / יעד.
 */
type ExportTarget = string;

// EXPORT_LAYOUT_STORAGE_KEY — ייצוא / פריסת מסך / מפתח.
const EXPORT_LAYOUT_STORAGE_KEY = 'gvk.dynamicScheduleExport.layout.v2';

/**
 * פעולה getMonthTarget: שליפה או חישוב של חודש / יעד.
 * @param offset — מיקום תחילת התוצאות.
 * @returns { year: number; month: number } — הפלט בהתאם לחתימה.
 */
function getMonthTarget(offset: number): { year: number; month: number } {
  const now = new Date();
  // date — תאריך.
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/**
 * פעולה formatMonthLabel: עיצוב ערך לתצוגה עבור חודש / תווית.
 * @param year — שנה.
 * @param month — חודש.
 * @returns string — הפלט בהתאם לחתימה.
 */
function formatMonthLabel(year: number, month: number): string {
  return `${hebrewMonths[month - 1] ?? month} ${year}`;
}


/**
 * פעולה readStoredLayout: פריסת מסך.
 * @param options — אפשרויות בחירה.
 * @returns ScheduleExcelLayout | null — הפלט בהתאם לחתימה.
 */
function readStoredLayout(options: ScheduleFileJobTypeOption[]): ScheduleExcelLayout | null {
  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
  try {
    const raw = window.localStorage.getItem(EXPORT_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ScheduleExcelLayout>;
    // validIds — הנתון validIds בהקשר הפעולה; אוסף ערכים ייחודיים.
    const validIds = new Set(options.map((option) => option.id));
    /**
     * פעולה clean: הנתון clean בהקשר הפעולה.
     * @param value — ערך.
     * @returns string | null — הפלט בהתאם לחתימה.
     */
    const clean = (value: unknown): string | null =>
      typeof value === 'string' && validIds.has(value) ? value : null;
    return {
      morningRowJobTypeId: clean(parsed.morningRowJobTypeId),
      eveningRowJobTypeId: clean(parsed.eveningRowJobTypeId),
      nightRowJobTypeId: clean(parsed.nightRowJobTypeId),
      parallelMorningJobTypeId: clean(parsed.parallelMorningJobTypeId),
      dailyJobTypeId: clean(parsed.dailyJobTypeId),
    };
  } catch {
    return null;
  }
}

/**
 * פעולה persistLayout: פריסת מסך.
 * @param layout — פריסת מסך.
 * @returns void — הפלט בהתאם לחתימה.
 */
function persistLayout(layout: ScheduleExcelLayout): void {
  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
  try {
    window.localStorage.setItem(EXPORT_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // localStorage can be unavailable in restricted/private browser modes.
  }
}

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'אירעה שגיאה ביצירת קובץ האקסל.';
}

/**
 * פעולה getModeLabel: שליפה או חישוב של מצב פעולה / תווית.
 * @param mode — מצב פעולה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getModeLabel(mode: ScheduleFileJobTypeOption['workMode']): string {
  if (mode === 'shifts') return 'משמרות';
  if (mode === 'on_call_hourly') return 'כוננות שעתית';
  if (mode === 'on_call_daily') return 'כוננות יומית';
  return 'מבנה לא מזוהה';
}

/**
 * פעולה ScheduleExportPanel: שיבוץ / ייצוא.
 */
function ScheduleExportPanel() {
  // מצב מקומי: target — יעד; setTarget מעדכנת אותו ומפעילה רינדור לפי React.
  const [target, setTarget] = useState<ExportTarget>('0');
  // מצב מקומי: snapshot — הנתון snapshot בהקשר הפעולה; setSnapshot מעדכנת אותו ומפעילה רינדור לפי React.
  const [snapshot, setSnapshot] = useState<ScheduleExcelLayout | null>(null);
  // מצב מקומי: isLoadingSnapshot — האם טעינה מתבצעת; setIsLoadingSnapshot מעדכנת אותו ומפעילה רינדור לפי React.
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  // מצב מקומי: isApprovingSnapshot — הנתון isApprovingSnapshot בהקשר הפעולה; setIsApprovingSnapshot מעדכנת אותו ומפעילה רינדור לפי React.
  const [isApprovingSnapshot, setIsApprovingSnapshot] = useState(false);
  // מצב מקומי: jobTypes — סוגי תפקידים; setJobTypes מעדכנת אותו ומפעילה רינדור לפי React.
  const [jobTypes, setJobTypes] = useState<ScheduleFileJobTypeOption[]>([]);
  // מצב מקומי: layout — פריסת מסך; setLayout מעדכנת אותו ומפעילה רינדור לפי React.
  const [layout, setLayout] = useState<ScheduleExcelLayout>({
    morningRowJobTypeId: null,
    eveningRowJobTypeId: null,
    nightRowJobTypeId: null,
    parallelMorningJobTypeId: null,
    dailyJobTypeId: null,
  });
  // מצב מקומי: isLoadingRoles — האם טעינה מתבצעת; setIsLoadingRoles מעדכנת אותו ומפעילה רינדור לפי React.
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  // מצב מקומי: isSavingLayout — האם שמירה מתבצעת; setIsSavingLayout מעדכנת אותו ומפעילה רינדור לפי React.
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  // מצב מקומי: hasSavedLayout — פריסת מסך; setHasSavedLayout מעדכנת אותו ומפעילה רינדור לפי React.
  const [hasSavedLayout, setHasSavedLayout] = useState(false);
  // מצב מקומי: isExporting — הנתון isExporting בהקשר הפעולה; setIsExporting מעדכנת אותו ומפעילה רינדור לפי React.
  const [isExporting, setIsExporting] = useState(false);
  // מצב מקומי: isSending — הנתון isSending בהקשר הפעולה; setIsSending מעדכנת אותו ומפעילה רינדור לפי React.
  const [isSending, setIsSending] = useState(false);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] = useState<string | null>(null);
  // מצב מקומי: successMessage — הודעה; setSuccessMessage מעדכנת אותו ומפעילה רינדור לפי React.
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ערך מחושב selectedTarget — נבחר / יעד; נשמר בין רינדורים עד שינוי התלויות.
  const selectedTarget = useMemo(() => getMonthTarget(Number(target)), [target]);
  // isHistorical — נתונים היסטוריים.
  const isHistorical = Number(target) < 0;
  // effectiveLayout — פריסת מסך.
  const effectiveLayout = isHistorical && snapshot ? snapshot : layout;

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [].
  useEffect(() => {
    // active — פעיל.
    let active = true;
    void (async () => {
      setIsLoadingRoles(true);
      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // options — אפשרויות בחירה.
        const options = await dynamicScheduleExportService.getJobTypeOptions();
        if (!active) return;
        setJobTypes(options);
        const saved = await scheduleExportLayoutSettingsService.load();
        if (!active) return;
        // validIds — הנתון validIds בהקשר הפעולה; אוסף ערכים ייחודיים.
        const validIds = new Set(options.map((option) => option.id));
        /**
         * פעולה clean: הנתון clean בהקשר הפעולה.
         * @param value — ערך.
         * @returns string | null — הפלט בהתאם לחתימה.
         */
        const clean = (value: string | null | undefined): string | null =>
          value && validIds.has(value) ? value : null;
        setLayout(saved ? {
          morningRowJobTypeId: clean(saved.morningRowJobTypeId),
          eveningRowJobTypeId: clean(saved.eveningRowJobTypeId),
          nightRowJobTypeId: clean(saved.nightRowJobTypeId),
          parallelMorningJobTypeId: clean(saved.parallelMorningJobTypeId),
          dailyJobTypeId: clean(saved.dailyJobTypeId),
        } : readStoredLayout(options) ?? dynamicScheduleExportService.createDefaultLayout(options));
        setHasSavedLayout(Boolean(saved));
      } catch (loadError) {
        if (active) setError(getErrorMessage(loadError));
      } finally {
        if (active) setIsLoadingRoles(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [selectedTarget.year, selectedTarget.month].
  useEffect(() => {
    // active — פעיל.
    let active = true;
    setSnapshot(null);
    setIsLoadingSnapshot(true);
    void scheduleExportLayoutSettingsService.loadMonthlySnapshot(selectedTarget.year, selectedTarget.month)
      .then((saved) => { if (active) setSnapshot(saved); })
      .catch((err) => { if (active) setError(getErrorMessage(err)); })
      .finally(() => { if (active) setIsLoadingSnapshot(false); });
    return () => { active = false; };
  }, [selectedTarget.year, selectedTarget.month]);

  /**
   * פעולה אסינכרונית approveHistoricalLayout: אישור נתונים היסטוריים / פריסת מסך.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const approveHistoricalLayout = async (): Promise<void> => {
    if (!isHistorical || snapshot || isLoadingSnapshot) return;
    setIsApprovingSnapshot(true);
    setError(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      const approved = await scheduleExportLayoutSettingsService.approveMonthlySnapshot(
        selectedTarget.year, selectedTarget.month, layout,
      );
      setSnapshot(approved);
      setSuccessMessage('מיפוי החודש אושר ונשמר. לא ניתן לדרוס אותו דרך המסך.');
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setIsApprovingSnapshot(false); }
  };

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [isLoadingRoles, jobTypes.length, layout].
  useEffect(() => {
    if (!isLoadingRoles && jobTypes.length > 0) persistLayout(layout);
  }, [isLoadingRoles, jobTypes.length, layout]);

  // ערך מחושב selectOptions — אפשרויות בחירה; נשמר בין רינדורים עד שינוי התלויות.
  const selectOptions = useMemo(() => [
    { value: '', label: 'לא בשימוש' },
    ...jobTypes.map((jobType) => ({
      value: jobType.id,
      label: `${jobType.name} · ${getModeLabel(jobType.workMode)}`,
    })),
  ], [jobTypes]);

  // ערך מחושב selectedNames — נבחר; נשמר בין רינדורים עד שינוי התלויות.
  const selectedNames = useMemo(() => {
    const names = new Map(jobTypes.map((jobType) => [jobType.id, jobType.name]));
    return {
      morning: effectiveLayout.morningRowJobTypeId ? names.get(effectiveLayout.morningRowJobTypeId) ?? 'לא נבחר' : 'לא בשימוש',
      evening: effectiveLayout.eveningRowJobTypeId ? names.get(effectiveLayout.eveningRowJobTypeId) ?? 'לא נבחר' : 'לא בשימוש',
      night: effectiveLayout.nightRowJobTypeId ? names.get(effectiveLayout.nightRowJobTypeId) ?? 'לא נבחר' : 'לא בשימוש',
      parallel: effectiveLayout.parallelMorningJobTypeId ? names.get(effectiveLayout.parallelMorningJobTypeId) ?? 'לא נבחר' : 'לא בשימוש',
      daily: effectiveLayout.dailyJobTypeId ? names.get(effectiveLayout.dailyJobTypeId) ?? 'לא נבחר' : 'לא בשימוש',
    };
  }, [jobTypes, effectiveLayout]);

  /**
   * פעולה אסינכרונית saveLayout: שמירת פריסת מסך.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const saveLayout = async (): Promise<void> => {
    setIsSavingLayout(true);
    setError(null);
    setSuccessMessage(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      await scheduleExportLayoutSettingsService.save(layout);
      setHasSavedLayout(true);
      setSuccessMessage('מיפוי הייצוא נשמר בשרת עבור כל המשתמשים המורשים.');
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSavingLayout(false);
    }
  };

  /**
   * פעולה resetLayout: איפוס פריסת מסך.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const resetLayout = (): void => {
    // nextLayout — פריסת מסך.
    const nextLayout = dynamicScheduleExportService.createDefaultLayout(jobTypes);
    setLayout(nextLayout);
    persistLayout(nextLayout);
    setError(null);
    setSuccessMessage(null);
  };

  /**
   * פעולה אסינכרונית handleExport: טיפול באירוע עבור ייצוא.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    setError(null);
    setSuccessMessage(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // result — תוצאה.
      const result = await dynamicScheduleExportService.exportMonth(
        selectedTarget.year,
        selectedTarget.month,
        effectiveLayout,
      );
      setSuccessMessage(`הקובץ ${result.fileName} נוצר והורד בהצלחה.`);
    } catch (exportError) {
      setError(getErrorMessage(exportError));
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * פעולה אסינכרונית handleSendToTeams: טיפול באירוע עבור הנתון handleSendToTeams בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleSendToTeams = async (): Promise<void> => {
    setIsSending(true);
    setError(null);
    setSuccessMessage(null);
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const { blob, result } = await dynamicScheduleExportService.createMonthFile(
        selectedTarget.year,
        selectedTarget.month,
        effectiveLayout,
      );
      // response — תוצאת הפעולה.
      const response = await scheduleArchiveService.sendScheduleFile(
        blob,
        result.fileName,
        result.year,
        result.month,
      );
      setSuccessMessage(
        response.auditLogged
          ? 'המייל עם קובץ השיבוצים נשלח בהצלחה. Power Automate אמור להעביר אותו ל-Teams.'
          : 'המייל נשלח בהצלחה, אך רישום הפעולה ביומן המערכת נכשל.',
      );
    } catch (sendError) {
      setError(getErrorMessage(sendError));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="settings-card-title-with-icon">
            <FileSpreadsheet size={19} aria-hidden="true" />
            ייצוא לוח שיבוצים
          </span>
        </CardTitle>
      </CardHeader>

      <CardBody>
        <div className="schedule-export-panel schedule-export-panel-dynamic">
          <p className="settings-placeholder-text">
            הייצוא משתמש בלוחות הדינמיים שפורסמו. לפני ההורדה אפשר לקבוע איזה תפקיד ימלא כל אזור בתבנית Excel.
          </p>

          <Select
            label="חודש לייצוא"
            value={target}
            disabled={isExporting || isSending}
            options={Array.from({ length: 14 }, (_, i) => {
              // offset — מיקום תחילת התוצאות.
              const offset = i - 12;
              // date — תאריך.
              const date = getMonthTarget(offset);
              return { value: String(offset), label: `${offset === 0 ? 'החודש הנוכחי — ' : offset === 1 ? 'החודש הבא — ' : ''}${formatMonthLabel(date.year, date.month)}` };
            })}
            onChange={(event) => {
              setTarget(event.target.value as ExportTarget);
              setError(null);
              setSuccessMessage(null);
            }}
          />

          <section className="schedule-export-layout-card" aria-labelledby="schedule-export-layout-title">
            <div className="schedule-export-layout-header">
              <div>
                <span className="schedule-export-layout-kicker"><Columns3 size={16} /> מבנה הקובץ</span>
                <h4 id="schedule-export-layout-title">שיוך עמודות לתפקידים</h4>
                <p>ברירת המחדל בנויה לפי הקובץ ששלחת: שורת בוקר נפרדת, ערב ולילה, תפקיד בוקר מקביל וכוננות יומית.</p>
              </div>
              <Button type="button" variant="secondary" disabled={isLoadingRoles} onClick={resetLayout}>
                <RotateCcw size={16} aria-hidden="true" />
                חזרה לברירת מחדל
              </Button>
            </div>

            {isHistorical ? (
              <div className="settings-message" role="status">
                {isLoadingSnapshot ? 'בודק מיפוי חודשי שמור...' : snapshot
                  ? 'מיפוי היסטורי מאושר נטען. הייצוא משתמש במיפוי השמור של חודש זה.'
                  : 'אין מיפוי היסטורי שמור. המיפוי המוצג הוא הצעה מהמיפוי המרכזי הנוכחי; יש להוריד את הקובץ, לבדוק אותו ולאשר את המיפוי לפני שליחה ל-Teams.'}
              </div>
            ) : null}
            <div className="schedule-export-mapping-grid">
              <div className="schedule-export-mapping-row">
                <div className="schedule-export-column-badge">C + D · שורה 1</div>
                <div className="schedule-export-mapping-copy">
                  <strong>שורת בוקר</strong>
                  <span>בדרך כלל 08:00–16:00. בחר כאן את תפקיד הבוקר הנפרד. אם אין משמרת בוקר אמיתית באותו יום, השורה תישאר ריקה ולא תועתק אליה משמרת ערב.</span>
                </div>
                <Select
                  label="תפקיד לשורת בוקר"
                  value={effectiveLayout.morningRowJobTypeId ?? ''}
                  disabled={isLoadingRoles || isExporting || isSending || isLoadingSnapshot || Boolean(isHistorical && snapshot)}
                  options={selectOptions}
                  onChange={(event) => setLayout((current) => ({ ...current, morningRowJobTypeId: event.target.value || null }))}
                />
              </div>

              <div className="schedule-export-mapping-row">
                <div className="schedule-export-column-badge">C + D · שורה 2</div>
                <div className="schedule-export-mapping-copy">
                  <strong>שורת ערב / צהריים</strong>
                  <span>בדרך כלל 16:00–23:00. אפשר לבחור את אותו תפקיד גם לשורת הלילה.</span>
                </div>
                <Select
                  label="תפקיד לשורת ערב"
                  value={effectiveLayout.eveningRowJobTypeId ?? ''}
                  disabled={isLoadingRoles || isExporting || isSending || isLoadingSnapshot || Boolean(isHistorical && snapshot)}
                  options={selectOptions}
                  onChange={(event) => setLayout((current) => ({ ...current, eveningRowJobTypeId: event.target.value || null }))}
                />
              </div>

              <div className="schedule-export-mapping-row">
                <div className="schedule-export-column-badge">C + D · שורה 3</div>
                <div className="schedule-export-mapping-copy">
                  <strong>שורת לילה</strong>
                  <span>בדרך כלל 23:00–06:00. משמרת שחוצה חצות תסומן באפור בקובץ.</span>
                </div>
                <Select
                  label="תפקיד לשורת לילה"
                  value={effectiveLayout.nightRowJobTypeId ?? ''}
                  disabled={isLoadingRoles || isExporting || isSending || isLoadingSnapshot || Boolean(isHistorical && snapshot)}
                  options={selectOptions}
                  onChange={(event) => setLayout((current) => ({ ...current, nightRowJobTypeId: event.target.value || null }))}
                />
              </div>

              <div className="schedule-export-mapping-row">
                <div className="schedule-export-column-badge">E + F</div>
                <div className="schedule-export-mapping-copy">
                  <strong>תפקיד בוקר מקביל</strong>
                  <span>נכתב פעם אחת בלבד בכל יום, בשורה הראשונה. המערכת בוחרת את המשמרת שחופפת בצורה הטובה ביותר לשורת הבוקר.</span>
                </div>
                <Select
                  label="תפקיד מקביל בבוקר"
                  value={effectiveLayout.parallelMorningJobTypeId ?? ''}
                  disabled={isLoadingRoles || isExporting || isSending || isLoadingSnapshot || Boolean(isHistorical && snapshot)}
                  options={selectOptions}
                  onChange={(event) => setLayout((current) => ({ ...current, parallelMorningJobTypeId: event.target.value || null }))}
                />
              </div>

              <div className="schedule-export-mapping-row">
                <div className="schedule-export-column-badge">G</div>
                <div className="schedule-export-mapping-copy">
                  <strong>כוננות יומית</strong>
                  <span>עובד אחד ליום בתא הממוזג שמכסה את שלוש שורות היום.</span>
                </div>
                <Select
                  label="תפקיד יומי"
                  value={effectiveLayout.dailyJobTypeId ?? ''}
                  disabled={isLoadingRoles || isExporting || isSending || isLoadingSnapshot || Boolean(isHistorical && snapshot)}
                  options={selectOptions}
                  onChange={(event) => setLayout((current) => ({ ...current, dailyJobTypeId: event.target.value || null }))}
                />
              </div>
            </div>

            <div className="schedule-export-template-preview" aria-label="תצוגה מקדימה של עמודות האקסל">
              <div><b>A</b><span>תאריך התחלה</span></div>
              <div><b>B</b><span>יום בשבוע</span></div>
              <div><b>C</b><span>שעת משמרת</span></div>
              <div className="schedule-export-template-preview-highlight"><b>D</b><span>{`בוקר: ${selectedNames.morning} · ערב: ${selectedNames.evening} · לילה: ${selectedNames.night}`}</span></div>
              <div><b>E</b><span>שעות תפקיד בוקר מקביל</span></div>
              <div className="schedule-export-template-preview-highlight"><b>F</b><span>{selectedNames.parallel}</span></div>
              <div className="schedule-export-template-preview-highlight"><b>G</b><span>{selectedNames.daily}</span></div>
              <div><b>H</b><span>הערות / חג ומועד</span></div>
            </div>
          </section>

          <div className="schedule-export-actions">
            <Button type="button" variant="secondary" disabled={isHistorical || isLoadingRoles || isSavingLayout || isExporting || isSending} onClick={() => void saveLayout()}>
              <Save size={17} aria-hidden="true" />
              {isSavingLayout ? 'שומר מיפוי...' : 'שמירת מיפוי בשרת'}
            </Button>
            <span>{hasSavedLayout ? 'קיים מיפוי שמור בשרת' : 'המיפוי עדיין לא נשמר בשרת'}</span>
          </div>

          <div className="schedule-export-summary">
            <span>הקובץ שייווצר</span>
            <strong>{`לוח שיבוצים ${formatMonthLabel(selectedTarget.year, selectedTarget.month)}.xlsx`}</strong>
          </div>

          {error ? <div className="settings-message settings-message-error" role="alert">{error}</div> : null}
          {successMessage ? <div className="settings-message settings-message-success" role="status">{successMessage}</div> : null}

          {isHistorical && !snapshot && !isLoadingSnapshot ? (
            <div className="schedule-export-actions">
              <Button type="button" variant="secondary" disabled={isApprovingSnapshot || isExporting || isSending || isLoadingRoles} onClick={() => void approveHistoricalLayout()}>
                {isApprovingSnapshot ? 'שומר אישור...' : 'בדקתי את הקובץ — אשר מיפוי לחודש זה'}
              </Button>
            </div>
          ) : null}
          <div className="schedule-export-actions">
            <Button type="button" disabled={isExporting || isSending || isLoadingRoles || isLoadingSnapshot} onClick={() => void handleExport()}>
              {isExporting ? <LoaderCircle className="schedule-export-spinner" size={17} aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
              {isExporting ? 'יוצר קובץ...' : 'הורדת קובץ Excel'}
            </Button>

            <Button type="button" variant="secondary" disabled={isExporting || isSending || isLoadingRoles || isLoadingSnapshot || (isHistorical && !snapshot)} onClick={() => void handleSendToTeams()}>
              {isSending ? <LoaderCircle className="schedule-export-spinner" size={17} aria-hidden="true" /> : <CloudUpload size={17} aria-hidden="true" />}
              {isSending ? 'שולח...' : 'שליחה ל-Teams'}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default ScheduleExportPanel;
