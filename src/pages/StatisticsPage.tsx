/**
 * קובץ: src/pages/StatisticsPage.tsx
 * מטרה: מימוש מסך המשתמש עבור סטטיסטיקה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: WorkspaceView, personLabel, StatisticsPage.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  RefreshCw,
  Table2,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Button, PageHeader } from '../components/ui';
import StatisticsMultiSelect from '../features/statistics/components/StatisticsMultiSelect';
import DynamicJobTypeStatisticsView from '../features/statistics/views/DynamicJobTypeStatisticsView';
import ActivityTrackingStatistics from '../features/statistics/views/ActivityTrackingStatistics';
import { dynamicStatisticsService } from '../services/dynamicStatisticsService';
import type {
  DynamicStatisticsJobTypeOption,
  DynamicStatisticsWorkspace,
} from '../types/dynamicStatistics';
import type { StatisticsPeriodMode } from '../types/activityTracking';
import '../styles/statistics.css';

import LegacyStatisticsPage from './LegacyStatisticsPage';

/**
 * טיפוס WorkspaceView: הנתון WorkspaceView בהקשר הפעולה.
 */
type WorkspaceView = 'overview' | 'availability' | 'charts' | 'tables' | 'payroll';

// hebrewMonths — חודשים.
const hebrewMonths = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
/**
 * פעולה isoDate: תאריך.
 * @param date — תאריך.
 */
const isoDate=(date:Date)=>{const y=date.getFullYear();const m=String(date.getMonth()+1).padStart(2,'0');const d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`};
/**
 * פעולה periodRange: תקופה.
 * @param mode — מצב פעולה.
 * @param anchor — הנתון anchor בהקשר הפעולה.
 */
const periodRange=(mode:StatisticsPeriodMode,anchor:Date)=>{const start=new Date(anchor);const end=new Date(anchor);if(mode==='day')return{start:isoDate(start),end:isoDate(end)};if(mode==='week'){const day=start.getDay();start.setDate(start.getDate()-day);end.setTime(start.getTime());end.setDate(end.getDate()+6);return{start:isoDate(start),end:isoDate(end)}}if(mode==='month'){start.setDate(1);end.setMonth(end.getMonth()+1,0);return{start:isoDate(start),end:isoDate(end)}}start.setMonth(0,1);end.setMonth(11,31);return{start:isoDate(start),end:isoDate(end)}};
/**
 * פעולה shiftPeriod: משמרת / תקופה.
 * @param mode — מצב פעולה.
 * @param anchor — הנתון anchor בהקשר הפעולה.
 * @param direction — הנתון direction בהקשר הפעולה.
 */
const shiftPeriod=(mode:StatisticsPeriodMode,anchor:Date,direction:number)=>{const next=new Date(anchor);if(mode==='day')next.setDate(next.getDate()+direction);else if(mode==='week')next.setDate(next.getDate()+direction*7);else if(mode==='month')return new Date(anchor.getFullYear(),anchor.getMonth()+direction,1);else return new Date(anchor.getFullYear()+direction,0,1);return next};
/**
 * פעולה periodLabel: תקופה / תווית.
 * @param mode — מצב פעולה.
 * @param anchor — הנתון anchor בהקשר הפעולה.
 */
const periodLabel=(mode:StatisticsPeriodMode,anchor:Date)=>{const r=periodRange(mode,anchor);if(mode==='day')return anchor.toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});if(mode==='week')return `${new Date(`${r.start}T12:00:00`).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'})}–${new Date(`${r.end}T12:00:00`).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'})}`;if(mode==='month')return `${hebrewMonths[anchor.getMonth()]} ${anchor.getFullYear()}`;return String(anchor.getFullYear())};

/**
 * פעולה personLabel: תווית.
 * @param displayName — שם תצוגה.
 * @param scheduleName — שיבוץ / שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function personLabel(
  displayName: string,
  scheduleName: string | null,
): string {
  return scheduleName?.trim() || displayName.trim() || 'ללא שם';
}

/**
 * פעולה StatisticsPage: סטטיסטיקה.
 */
function StatisticsPage() {
  const legacyRequested = new URLSearchParams(window.location.search).get('legacy') === '1';
  // מצב מקומי: jobTypes — סוגי תפקידים; setJobTypes מעדכנת אותו ומפעילה רינדור לפי React.
  const [jobTypes, setJobTypes] = useState<DynamicStatisticsJobTypeOption[]>([]);
  // מצב מקומי: selectedJobTypeId — מזהה סוג התפקיד; setSelectedJobTypeId מעדכנת אותו ומפעילה רינדור לפי React.
  const [selectedJobTypeId, setSelectedJobTypeId] = useState('');
  // מצב מקומי: workspace — הנתון workspace בהקשר הפעולה; setWorkspace מעדכנת אותו ומפעילה רינדור לפי React.
  const [workspace, setWorkspace] = useState<DynamicStatisticsWorkspace | null>(null);
  // מצב מקומי: selectedUserIds — מזהי המשתמשים שנבחרו; setSelectedUserIds מעדכנת אותו ומפעילה רינדור לפי React.
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  // מצב מקומי: years — שנים; setYears מעדכנת אותו ומפעילה רינדור לפי React.
  const [years, setYears] = useState<number[]>([]);
  // מצב מקומי: months — חודשים; setMonths מעדכנת אותו ומפעילה רינדור לפי React.
  const [months, setMonths] = useState<number[]>([]);
  // מצב מקומי: view — הנתון view בהקשר הפעולה; setView מעדכנת אותו ומפעילה רינדור לפי React.
  const [view, setView] = useState<WorkspaceView>('overview');
  // מצב מקומי: isLoadingJobTypes — האם טעינה מתבצעת; setIsLoadingJobTypes מעדכנת אותו ומפעילה רינדור לפי React.
  const [isLoadingJobTypes, setIsLoadingJobTypes] = useState(true);
  // מצב מקומי: refreshNonce — הנתון refreshNonce בהקשר הפעולה; setRefreshNonce מעדכנת אותו ומפעילה רינדור לפי React.
  const [refreshNonce, setRefreshNonce] = useState(0);
  // מצב מקומי: isLoading — האם טעינה מתבצעת; setIsLoading מעדכנת אותו ומפעילה רינדור לפי React.
  const [isLoading, setIsLoading] = useState(false);
  // מצב מקומי: error — שגיאה; setError מעדכנת אותו ומפעילה רינדור לפי React.
  const [error, setError] = useState<string | null>(null);
  // מצב מקומי: periodMode — תקופה / מצב פעולה; setPeriodMode מעדכנת אותו ומפעילה רינדור לפי React.
  const [periodMode,setPeriodMode]=useState<StatisticsPeriodMode>('month');
  // מצב מקומי: periodAnchor — תקופה; setPeriodAnchor מעדכנת אותו ומפעילה רינדור לפי React.
  const [periodAnchor,setPeriodAnchor]=useState(()=>new Date());
  // מצב מקומי: selectedMonthKeys — נבחר / חודש; setSelectedMonthKeys מעדכנת אותו ומפעילה רינדור לפי React.
  const [selectedMonthKeys,setSelectedMonthKeys]=useState<string[]>([]);
  // מצב מקומי: selectedYears — נבחר / שנים; setSelectedYears מעדכנת אותו ומפעילה רינדור לפי React.
  const [selectedYears,setSelectedYears]=useState<number[]>([]);
  // מצב מקומי: isPeriodMenuOpen — תקופה; setIsPeriodMenuOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [isPeriodMenuOpen,setIsPeriodMenuOpen]=useState(false);
  // מצב מקומי: includeInactive — הנתון includeInactive בהקשר הפעולה; setIncludeInactive מעדכנת אותו ומפעילה רינדור לפי React.
  const [includeInactive,setIncludeInactive]=useState(false);
  // מצב מקומי: statisticalPeriods — תקופות; setStatisticalPeriods מעדכנת אותו ומפעילה רינדור לפי React.
  const [statisticalPeriods,setStatisticalPeriods]=useState<Array<{year:number;month:number}>>([]);
  // הפניה יציבה periodPickerRef בין רינדורים; שינוי current אינו מפעיל רינדור בפני עצמו.
  const periodPickerRef=useRef<HTMLDivElement | null>(null);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [legacyRequested].
  useEffect(() => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר legacyRequested.
    if (legacyRequested) {
      return;
    }

    let cancelled = false;

    /**
     * פעולה אסינכרונית loadJobTypes: טעינת סוגי תפקידים.
     * @returns Promise<void> — הפלט בהתאם לחתימה.
     */
    const loadJobTypes = async (): Promise<void> => {
      setIsLoadingJobTypes(true);
      setError(null);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // result — תוצאה.
        const result = await dynamicStatisticsService.getJobTypes();
        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר cancelled.
        if (cancelled) {
          return;
        }

        setJobTypes(result);
        setSelectedJobTypeId((current) => current || result[0]?.jobTypeId || '');
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'לא ניתן היה לטעון את התפקידים.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingJobTypes(false);
        }
      }
    };

    void loadJobTypes();

    return () => {
      cancelled = true;
    };
  }, [legacyRequested]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [legacyRequested, months, refreshNonce, selectedJobTypeId, selectedUserIds, years, jobTypes, includeInactive].
  useEffect(() => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר legacyRequested || !selectedJobTypeId.
    if (legacyRequested || !selectedJobTypeId) {
      return;
    }

    let cancelled = false;

    // selectedOption — נבחר.
    const selectedOption = jobTypes.find((item) => item.jobTypeId === selectedJobTypeId);
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר selectedOption?.personalOnly.
    if (selectedOption?.personalOnly) {
      // Personal statistics do not need the team workspace. Avoid writing a new
      // empty array on every effect pass: selectedUserIds is itself a dependency
      // of this effect, so setSelectedUserIds([]) here caused an infinite loop.
      setWorkspace(null);
      if (selectedUserIds.length > 0) {
        setSelectedUserIds([]);
      }
      setIsLoading(false);
      return;
    }

    /**
     * פעולה אסינכרונית loadWorkspace: טעינת הנתון loadWorkspace בהקשר הפעולה.
     * @returns Promise<void> — הפלט בהתאם לחתימה.
     */
    const loadWorkspace = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // result — תוצאה.
        const result = await dynamicStatisticsService.getWorkspace(
          selectedJobTypeId,
          years,
          months,
          selectedUserIds,
          includeInactive,
        );

        if (!cancelled) {
          setWorkspace(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'לא ניתן היה לטעון את הסטטיסטיקות.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [legacyRequested, months, refreshNonce, selectedJobTypeId, selectedUserIds, years, jobTypes, includeInactive]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [legacyRequested, selectedJobTypeId, refreshNonce].
  useEffect(() => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר legacyRequested || !selectedJobTypeId.
    if (legacyRequested || !selectedJobTypeId) {
      setStatisticalPeriods([]);
      return;
    }

    let cancelled = false;

    void dynamicStatisticsService.getAvailablePeriods(selectedJobTypeId)
      .then((periods) => {
        if (cancelled) return;
        setStatisticalPeriods(periods);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setStatisticalPeriods([]);
        setError(loadError instanceof Error ? loadError.message : 'לא ניתן היה לטעון את התקופות הסטטיסטיות.');
      });

    return () => {
      cancelled = true;
    };
  }, [legacyRequested, selectedJobTypeId, refreshNonce]);

  // selectedJobType — סוג תפקיד.
  const selectedJobType = jobTypes.find((jobType) => jobType.jobTypeId === selectedJobTypeId) ?? null;
  const activityOnly=Boolean(selectedJobType?.activityTrackingEnabled && selectedJobType.workMode==='none');
  // activeRange — פעיל.
  const activeRange=periodRange(periodMode,periodAnchor);
  // selectedMonthNumbers — נבחר / חודש.
  const selectedMonthNumbers=selectedMonthKeys.filter(key=>key.startsWith(`${periodAnchor.getFullYear()}-`)).map(key=>Number(key.slice(5)));
  // effectiveMonthNumbers — חודש.
  const effectiveMonthNumbers=periodMode==='month'?(selectedMonthNumbers.length?selectedMonthNumbers:[periodAnchor.getMonth()+1]):[];
  // effectiveYears — שנים.
  const effectiveYears=periodMode==='year'?(selectedYears.length?selectedYears:[periodAnchor.getFullYear()]):[periodAnchor.getFullYear()];
  const activityRanges=periodMode==='month'
    ? effectiveMonthNumbers.map(month=>periodRange('month',new Date(periodAnchor.getFullYear(),month-1,1)))
    : periodMode==='year'
      ? effectiveYears.map(year=>periodRange('year',new Date(year,0,1)))
      : [activeRange];
  // selectedPeriodCount — נבחר / תקופה / כמות.
  const selectedPeriodCount=periodMode==='month'?effectiveMonthNumbers.length:periodMode==='year'?effectiveYears.length:1;
  // triggerPeriodLabel — תקופה / תווית.
  const triggerPeriodLabel=selectedPeriodCount>1
    ? `${selectedPeriodCount} תקופות נבחרו`
    : periodMode==='month' && effectiveMonthNumbers.length===1
      ? periodLabel('month',new Date(periodAnchor.getFullYear(),effectiveMonthNumbers[0]-1,1))
      : periodMode==='year' && effectiveYears.length===1
        ? String(effectiveYears[0])
        : periodLabel(periodMode,periodAnchor);
  // availablePeriodModes — תקופה.
  const availablePeriodModes: Array<[StatisticsPeriodMode,string]> = activityOnly
    ? [['day','היום'],['week','שבוע'],['month','חודש'],['year','שנה']]
    : [['month','חודש'],['year','שנה']];
  // periodModeLabel — תקופה / מצב פעולה / תווית.
  const periodModeLabel=availablePeriodModes.find(([value])=>value===periodMode)?.[1] ?? 'תקופה';

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [isPeriodMenuOpen].
  useEffect(()=>{
    if(!isPeriodMenuOpen)return;
    /**
     * פעולה handlePointerDown: טיפול באירוע עבור הנתון handlePointerDown בהקשר הפעולה.
     * @param event — אירוע.
     */
    const handlePointerDown=(event:MouseEvent)=>{
      if(periodPickerRef.current && !periodPickerRef.current.contains(event.target as Node))setIsPeriodMenuOpen(false);
    };
    /**
     * פעולה handleKeyDown: טיפול באירוע עבור מפתח.
     * @param event — אירוע.
     */
    const handleKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setIsPeriodMenuOpen(false)};
    document.addEventListener('mousedown',handlePointerDown);
    document.addEventListener('keydown',handleKeyDown);
    return()=>{document.removeEventListener('mousedown',handlePointerDown);document.removeEventListener('keydown',handleKeyDown)};
  },[isPeriodMenuOpen]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [activityOnly,periodMode,periodAnchor,selectedMonthKeys,selectedYears].
  useEffect(()=>{
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !activityOnly && (periodMode==='day'||periodMode==='week').
    if(!activityOnly && (periodMode==='day'||periodMode==='week')){setPeriodMode('month');return;}
    if(activityOnly)return;
    setYears(effectiveYears);
    setMonths(periodMode==='month'?effectiveMonthNumbers:[]);
  },[activityOnly,periodMode,periodAnchor,selectedMonthKeys,selectedYears]);

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [periodMode,periodAnchor,selectedMonthKeys.length,selectedYears.length].
  useEffect(()=>{
    if(periodMode==='month' && selectedMonthKeys.length===0)setSelectedMonthKeys([`${periodAnchor.getFullYear()}-${String(periodAnchor.getMonth()+1).padStart(2,'0')}`]);
    if(periodMode==='year' && selectedYears.length===0)setSelectedYears([periodAnchor.getFullYear()]);
  },[periodMode,periodAnchor,selectedMonthKeys.length,selectedYears.length]);

  // ערך מחושב availableMonthOptions — חודש / אפשרויות בחירה; נשמר בין רינדורים עד שינוי התלויות.
  const availableMonthOptions=useMemo(()=>{
    // year — שנה.
    const year=periodAnchor.getFullYear();
    return hebrewMonths.map((label,index)=>({
      key:`${year}-${String(index+1).padStart(2,'0')}`,
      label,
    }));
  },[periodAnchor]);

  // ערך מחושב availableYearOptions — שנה / אפשרויות בחירה; נשמר בין רינדורים עד שינוי התלויות.
  const availableYearOptions=useMemo(()=>
    Array.from(new Set([...statisticalPeriods.map(item=>item.year),periodAnchor.getFullYear(),new Date().getFullYear()])).sort((a,b)=>b-a)
  ,[statisticalPeriods]);

  // Do not force the selection back to the latest month containing data.
  // A new month is valid even before any shifts or availability have been recorded.

  /**
   * פעולה navigatePeriod: תקופה.
   * @param direction — הנתון direction בהקשר הפעולה.
   * @returns void — הפלט בהתאם לחתימה.
   */
  const navigatePeriod = (direction: number): void => {
    // next — הנתון next בהקשר הפעולה.
    const next = shiftPeriod(periodMode, periodAnchor, direction);
    setPeriodAnchor(next);
    if (periodMode === 'month') {
      setSelectedMonthKeys([`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`]);
    } else if (periodMode === 'year') {
      setSelectedYears([next.getFullYear()]);
    }
  };

  // ערך מחושב peopleOptions — אפשרויות בחירה; נשמר בין רינדורים עד שינוי התלויות.
  const peopleOptions = useMemo(() => (
    workspace?.people
      .map((person) => ({
        value: person.userId,
        label: `${personLabel(person.displayName, person.scheduleName)}${person.isActive ? '' : ' · מושבת'}`,
        muted: !person.isActive,
      }))
      .sort((left, right) => Number(left.muted) - Number(right.muted) || left.label.localeCompare(right.label, 'he')) ?? []
  ), [workspace]);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר legacyRequested.
  if (legacyRequested) {
    return <LegacyStatisticsPage />;
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isLoadingJobTypes && jobTypes.length === 0.
  if (!isLoadingJobTypes && jobTypes.length === 0) {
    return <LegacyStatisticsPage />;
  }

  // viewOptions — אפשרויות בחירה.
  const viewOptions: Array<{
    // value — ערך.
    value: WorkspaceView;
    // label — תווית.
    label: string;
    icon: typeof LayoutDashboard;
  }> = selectedJobType?.personalOnly
    ? [
        { value: 'overview', label: 'סקירה', icon: LayoutDashboard },
        { value: 'charts', label: 'גרפים', icon: BarChart3 },
        { value: 'tables', label: 'טבלאות', icon: Table2 },
      ]
    : [
        { value: 'overview', label: 'סקירה', icon: LayoutDashboard },
        ...(selectedJobType?.availabilityEnabled
          ? [{ value: 'availability' as const, label: 'אילוצים', icon: CalendarCheck2 }]
          : []),
        { value: 'charts', label: 'גרפים', icon: BarChart3 },
        { value: 'tables', label: 'טבלאות', icon: Table2 },
        ...(selectedJobType?.payrollEnabled
          ? [{ value: 'payroll' as const, label: 'שכר', icon: WalletCards }]
          : []),
      ];

  return (
    <section className="statistics-page">
      <PageHeader
        title="סטטיסטיקות"
        description="ניתוח שיבוצים, אילוצים, עומסי עבודה ושכר לפי תפקיד, עובדים ותקופות."
        actions={(
          <Button
            type="button"
            variant="secondary"
            disabled={isLoading || !selectedJobTypeId}
            onClick={() => {
              setRefreshNonce((value) => value + 1);
            }}
          >
            <RefreshCw
              size={17}
              className={isLoading ? 'statistics-spin' : undefined}
              aria-hidden="true"
            />
            רענון
          </Button>
        )}
      />

      <section className="statistics-workspace-step">
        <header>
          <span>שלב 1</span>
          <div>
            <h2>איזה תפקיד לנתח?</h2>
            <p>מוצגים רק תפקידים שבהגדרתם הופעלה יכולת הסטטיסטיקות.</p>
          </div>
        </header>

        <div className="statistics-user-type-grid">
          {jobTypes.map((jobType) => (
            <button
              key={jobType.jobTypeId}
              type="button"
              className={selectedJobTypeId === jobType.jobTypeId
                ? 'statistics-user-type-card statistics-user-type-card-active'
                : 'statistics-user-type-card'}
              onClick={() => {
                setSelectedJobTypeId(jobType.jobTypeId);
                setSelectedUserIds([]);
                setIncludeInactive(false);
                setYears([]);
                setMonths([]);
                setPeriodMode(jobType.activityTrackingEnabled && jobType.workMode==='none'?'week':'month');
                setPeriodAnchor(new Date());
                setSelectedMonthKeys([]);
                setSelectedYears([]);
                setView('overview');
              }}
            >
              <Users size={20} aria-hidden="true" />
              <strong>{jobType.name}</strong>
              <small>{jobType.memberCount} עובדים · {jobType.dataPeriodCount} תקופות נתונים</small>
            </button>
          ))}
        </div>
      </section>

      <section className="statistics-workspace-step">
        <header>
          <span>שלב 2</span>
          <div>
            <h2>מי ובאיזו תקופה?</h2>
            <p>השארת מסנן ריק פירושה כל העובדים או כל התקופות הקיימות בתפקיד.</p>
          </div>
        </header>

        <div className="statistics-filters statistics-period-filters statistics-period-unified">
          <div className="statistics-people-filter-group">
            <StatisticsMultiSelect
              label="עובדים"
              allLabel={includeInactive ? "כל העובדים" : "כל העובדים הפעילים"}
              selectedValues={selectedUserIds}
              options={peopleOptions}
              disabled={isLoading || !workspace}
              onChange={(values) => setSelectedUserIds(values.filter((value): value is string => typeof value === 'string'))}
              inclusionMode={selectedJobType?.personalOnly ? undefined : (includeInactive ? 'all' : 'active')}
              onInclusionModeChange={selectedJobType?.personalOnly ? undefined : (mode) => {
                setIncludeInactive(mode === 'all');
                setSelectedUserIds([]);
              }}
            />
          </div>
          <div className="statistics-compact-period">
            <span className="statistics-compact-period-label">תקופה</span>
            <div className="statistics-compact-period-control" ref={periodPickerRef}>
              <button type="button" className="statistics-period-arrow" aria-label="תקופה קודמת" onClick={()=>navigatePeriod(-1)}><ChevronRight size={18}/></button>
              <div className="statistics-period-picker">
                <button type="button" className="statistics-period-trigger" aria-haspopup="dialog" aria-expanded={isPeriodMenuOpen} onClick={()=>setIsPeriodMenuOpen(open=>!open)}>
                  <CalendarDays size={17} aria-hidden="true"/>
                  <span><small>{periodModeLabel}</small><strong>{triggerPeriodLabel}</strong></span>
                  <ChevronDown size={16} aria-hidden="true"/>
                </button>
                {isPeriodMenuOpen ? <div className="statistics-period-popover" role="dialog" aria-label="בחירת תקופת ניתוח">
                  <span>הצג לפי</span>
                  <div className="statistics-period-mode" role="group" aria-label="רמת תקופת הניתוח">
                    {availablePeriodModes.map(([value,label])=><button key={value} type="button" className={periodMode===value?'active':''} onClick={()=>{setPeriodMode(value);if(value==='month')setSelectedMonthKeys([]);if(value==='year')setSelectedYears([])}}>{label}</button>)}
                  </div>
                  {periodMode==='month' ? <div className="statistics-period-multi-list">
                    <div className="statistics-period-multi-heading"><strong>{periodAnchor.getFullYear()}</strong><button type="button" onClick={()=>setSelectedMonthKeys(availableMonthOptions.map(item=>item.key))}>בחר הכל</button></div>
                    {availableMonthOptions.map(item=><label key={item.key}><input type="checkbox" checked={selectedMonthKeys.includes(item.key)} onChange={()=>setSelectedMonthKeys(current=>{
                      // next — הנתון next בהקשר הפעולה.
                      const next=current.includes(item.key)
                        ? (current.length>1?current.filter(key=>key!==item.key):current)
                        : [...current,item.key];
                      if(next.length===1){
                        const [yearText,monthText]=next[0].split('-');
                        // year — שנה.
                        const year=Number(yearText);
                        // month — חודש.
                        const month=Number(monthText);
                        if(Number.isFinite(year)&&Number.isFinite(month)){
                          setPeriodAnchor(new Date(year,month-1,1));
                        }
                      }
                      return next;
                    })}/><span>{item.label}</span></label>)}
                  </div> : periodMode==='year' ? <div className="statistics-period-multi-list">
                    {availableYearOptions.map(year=><label key={year}><input type="checkbox" checked={selectedYears.includes(year)} onChange={()=>setSelectedYears(current=>{
                      // next — הנתון next בהקשר הפעולה.
                      const next=current.includes(year)
                        ? (current.length>1?current.filter(value=>value!==year):current)
                        : [...current,year];
                      if(next.length===1){
                        setPeriodAnchor(new Date(next[0],0,1));
                      }
                      return next;
                    })}/><span>{year}</span></label>)}
                  </div> : <div className="statistics-period-popover-current">{periodLabel(periodMode,periodAnchor)}</div>}
                  <button type="button" className="statistics-period-current-button" onClick={()=>{const now=new Date();setPeriodAnchor(now);setSelectedMonthKeys([]);setSelectedYears([]);setIsPeriodMenuOpen(false)}}>חזרה לתקופה הנוכחית</button>
                </div> : null}
              </div>
              <button type="button" className="statistics-period-arrow" aria-label="תקופה הבאה" onClick={()=>navigatePeriod(1)}><ChevronLeft size={18}/></button>
            </div>
          </div>
        </div>
      </section>

      <section className="statistics-workspace-step">
        <header>
          <span>שלב 3</span>
          <div>
            <h2>איך להציג?</h2>
            <p>התצוגות נקבעות לפי היכולות והנתונים של התפקיד, לא לפי שם התפקיד.</p>
          </div>
        </header>

        <div className="statistics-view-choice-grid">
          {viewOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                className={view === option.value
                  ? 'statistics-view-choice statistics-view-choice-active'
                  : 'statistics-view-choice'}
                onClick={() => setView(option.value)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {error ? (
        <div className="statistics-error" role="alert">
          <strong>לא ניתן היה לטעון את הסטטיסטיקות</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {isLoading && !workspace ? (
        <div className="statistics-loading">
          <RefreshCw size={30} className="statistics-spin" aria-hidden="true" />
          <span>טוען נתוני סטטיסטיקה...</span>
        </div>
      ) : null}

      {selectedJobTypeId && selectedJobType?.activityTrackingEnabled ? <ActivityTrackingStatistics jobTypeId={selectedJobTypeId} mode={view} selectedUserIds={selectedUserIds} rangeStart={activeRange.start} rangeEnd={activeRange.end} ranges={activityRanges} periodMode={periodMode} canEdit={!selectedJobType?.personalOnly} includeInactive={includeInactive} /> : null}

      {workspace && !(selectedJobType?.activityTrackingEnabled && selectedJobType.workMode === 'none') ? (
        <DynamicJobTypeStatisticsView
          data={workspace}
          selectedUserIds={selectedUserIds}
          mode={view}
          attendanceEnabled={selectedJobType?.attendanceEnabled ?? false}
        />
      ) : null}
    </section>
  );
}

export default StatisticsPage;
