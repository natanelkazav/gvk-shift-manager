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

const hebrewMonths = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

type ExportTarget = string;

const EXPORT_LAYOUT_STORAGE_KEY = 'gvk.dynamicScheduleExport.layout.v2';

function getMonthTarget(offset: number): { year: number; month: number } {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function formatMonthLabel(year: number, month: number): string {
  return `${hebrewMonths[month - 1] ?? month} ${year}`;
}


function readStoredLayout(options: ScheduleFileJobTypeOption[]): ScheduleExcelLayout | null {
  try {
    const raw = window.localStorage.getItem(EXPORT_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ScheduleExcelLayout>;
    const validIds = new Set(options.map((option) => option.id));
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

function persistLayout(layout: ScheduleExcelLayout): void {
  try {
    window.localStorage.setItem(EXPORT_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // localStorage can be unavailable in restricted/private browser modes.
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'אירעה שגיאה ביצירת קובץ האקסל.';
}

function getModeLabel(mode: ScheduleFileJobTypeOption['workMode']): string {
  if (mode === 'shifts') return 'משמרות';
  if (mode === 'on_call_hourly') return 'כוננות שעתית';
  if (mode === 'on_call_daily') return 'כוננות יומית';
  return 'מבנה לא מזוהה';
}

function ScheduleExportPanel() {
  const [target, setTarget] = useState<ExportTarget>('0');
  const [snapshot, setSnapshot] = useState<ScheduleExcelLayout | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [isApprovingSnapshot, setIsApprovingSnapshot] = useState(false);
  const [jobTypes, setJobTypes] = useState<ScheduleFileJobTypeOption[]>([]);
  const [layout, setLayout] = useState<ScheduleExcelLayout>({
    morningRowJobTypeId: null,
    eveningRowJobTypeId: null,
    nightRowJobTypeId: null,
    parallelMorningJobTypeId: null,
    dailyJobTypeId: null,
  });
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [hasSavedLayout, setHasSavedLayout] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedTarget = useMemo(() => getMonthTarget(Number(target)), [target]);
  const isHistorical = Number(target) < 0;
  const effectiveLayout = isHistorical && snapshot ? snapshot : layout;

  useEffect(() => {
    let active = true;
    void (async () => {
      setIsLoadingRoles(true);
      try {
        const options = await dynamicScheduleExportService.getJobTypeOptions();
        if (!active) return;
        setJobTypes(options);
        const saved = await scheduleExportLayoutSettingsService.load();
        if (!active) return;
        const validIds = new Set(options.map((option) => option.id));
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

  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setIsLoadingSnapshot(true);
    void scheduleExportLayoutSettingsService.loadMonthlySnapshot(selectedTarget.year, selectedTarget.month)
      .then((saved) => { if (active) setSnapshot(saved); })
      .catch((err) => { if (active) setError(getErrorMessage(err)); })
      .finally(() => { if (active) setIsLoadingSnapshot(false); });
    return () => { active = false; };
  }, [selectedTarget.year, selectedTarget.month]);

  const approveHistoricalLayout = async (): Promise<void> => {
    if (!isHistorical || snapshot || isLoadingSnapshot) return;
    setIsApprovingSnapshot(true);
    setError(null);
    try {
      const approved = await scheduleExportLayoutSettingsService.approveMonthlySnapshot(
        selectedTarget.year, selectedTarget.month, layout,
      );
      setSnapshot(approved);
      setSuccessMessage('מיפוי החודש אושר ונשמר. לא ניתן לדרוס אותו דרך המסך.');
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setIsApprovingSnapshot(false); }
  };

  useEffect(() => {
    if (!isLoadingRoles && jobTypes.length > 0) persistLayout(layout);
  }, [isLoadingRoles, jobTypes.length, layout]);

  const selectOptions = useMemo(() => [
    { value: '', label: 'לא בשימוש' },
    ...jobTypes.map((jobType) => ({
      value: jobType.id,
      label: `${jobType.name} · ${getModeLabel(jobType.workMode)}`,
    })),
  ], [jobTypes]);

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

  const saveLayout = async (): Promise<void> => {
    setIsSavingLayout(true);
    setError(null);
    setSuccessMessage(null);
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

  const resetLayout = (): void => {
    const nextLayout = dynamicScheduleExportService.createDefaultLayout(jobTypes);
    setLayout(nextLayout);
    persistLayout(nextLayout);
    setError(null);
    setSuccessMessage(null);
  };

  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    setError(null);
    setSuccessMessage(null);
    try {
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

  const handleSendToTeams = async (): Promise<void> => {
    setIsSending(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const { blob, result } = await dynamicScheduleExportService.createMonthFile(
        selectedTarget.year,
        selectedTarget.month,
        effectiveLayout,
      );
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
              const offset = i - 12;
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
