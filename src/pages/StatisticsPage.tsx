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

type WorkspaceView = 'overview' | 'availability' | 'charts' | 'tables' | 'payroll';

const hebrewMonths = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const isoDate=(date:Date)=>{const y=date.getFullYear();const m=String(date.getMonth()+1).padStart(2,'0');const d=String(date.getDate()).padStart(2,'0');return `${y}-${m}-${d}`};
const periodRange=(mode:StatisticsPeriodMode,anchor:Date)=>{const start=new Date(anchor);const end=new Date(anchor);if(mode==='day')return{start:isoDate(start),end:isoDate(end)};if(mode==='week'){const day=(start.getDay()+6)%7;start.setDate(start.getDate()-day);end.setTime(start.getTime());end.setDate(end.getDate()+6);return{start:isoDate(start),end:isoDate(end)}}if(mode==='month'){start.setDate(1);end.setMonth(end.getMonth()+1,0);return{start:isoDate(start),end:isoDate(end)}}start.setMonth(0,1);end.setMonth(11,31);return{start:isoDate(start),end:isoDate(end)}};
const shiftPeriod=(mode:StatisticsPeriodMode,anchor:Date,direction:number)=>{const next=new Date(anchor);if(mode==='day')next.setDate(next.getDate()+direction);else if(mode==='week')next.setDate(next.getDate()+direction*7);else if(mode==='month')next.setMonth(next.getMonth()+direction);else next.setFullYear(next.getFullYear()+direction);return next};
const periodLabel=(mode:StatisticsPeriodMode,anchor:Date)=>{const r=periodRange(mode,anchor);if(mode==='day')return anchor.toLocaleDateString('he-IL',{weekday:'long',day:'numeric',month:'long'});if(mode==='week')return `${new Date(`${r.start}T12:00:00`).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit'})}–${new Date(`${r.end}T12:00:00`).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'})}`;if(mode==='month')return `${hebrewMonths[anchor.getMonth()]} ${anchor.getFullYear()}`;return String(anchor.getFullYear())};

function personLabel(
  displayName: string,
  scheduleName: string | null,
): string {
  return scheduleName?.trim() || displayName.trim() || 'ללא שם';
}

function StatisticsPage() {
  const legacyRequested = new URLSearchParams(window.location.search).get('legacy') === '1';
  const [jobTypes, setJobTypes] = useState<DynamicStatisticsJobTypeOption[]>([]);
  const [selectedJobTypeId, setSelectedJobTypeId] = useState('');
  const [workspace, setWorkspace] = useState<DynamicStatisticsWorkspace | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [months, setMonths] = useState<number[]>([]);
  const [view, setView] = useState<WorkspaceView>('overview');
  const [isLoadingJobTypes, setIsLoadingJobTypes] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodMode,setPeriodMode]=useState<StatisticsPeriodMode>('month');
  const [periodAnchor,setPeriodAnchor]=useState(()=>new Date());
  const [isPeriodMenuOpen,setIsPeriodMenuOpen]=useState(false);
  const periodPickerRef=useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (legacyRequested) {
      return;
    }

    let cancelled = false;

    const loadJobTypes = async (): Promise<void> => {
      setIsLoadingJobTypes(true);
      setError(null);

      try {
        const result = await dynamicStatisticsService.getJobTypes();
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

  useEffect(() => {
    if (legacyRequested || !selectedJobTypeId) {
      return;
    }

    let cancelled = false;

    const selectedOption = jobTypes.find((item) => item.jobTypeId === selectedJobTypeId);
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

    const loadWorkspace = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await dynamicStatisticsService.getWorkspace(
          selectedJobTypeId,
          years,
          months,
          selectedUserIds,
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
  }, [legacyRequested, months, refreshNonce, selectedJobTypeId, selectedUserIds, years, jobTypes]);

  const selectedJobType = jobTypes.find((jobType) => jobType.jobTypeId === selectedJobTypeId) ?? null;
  const activityOnly=Boolean(selectedJobType?.activityTrackingEnabled && selectedJobType.workMode==='none');
  const activeRange=periodRange(periodMode,periodAnchor);
  const availablePeriodModes: Array<[StatisticsPeriodMode,string]> = activityOnly
    ? [['day','היום'],['week','שבוע'],['month','חודש'],['year','שנה']]
    : [['month','חודש'],['year','שנה']];
  const periodModeLabel=availablePeriodModes.find(([value])=>value===periodMode)?.[1] ?? 'תקופה';

  useEffect(()=>{
    if(!isPeriodMenuOpen)return;
    const handlePointerDown=(event:MouseEvent)=>{
      if(periodPickerRef.current && !periodPickerRef.current.contains(event.target as Node))setIsPeriodMenuOpen(false);
    };
    const handleKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setIsPeriodMenuOpen(false)};
    document.addEventListener('mousedown',handlePointerDown);
    document.addEventListener('keydown',handleKeyDown);
    return()=>{document.removeEventListener('mousedown',handlePointerDown);document.removeEventListener('keydown',handleKeyDown)};
  },[isPeriodMenuOpen]);

  useEffect(()=>{
    if(activityOnly)return;
    if(periodMode==='day'||periodMode==='week'){setPeriodMode('month');return;}
    setYears([periodAnchor.getFullYear()]);
    setMonths(periodMode==='month'?[periodAnchor.getMonth()+1]:[]);
  },[activityOnly,periodMode,periodAnchor]);

  const peopleOptions = useMemo(() => (
    workspace?.people.map((person) => ({
      value: person.userId,
      label: `${personLabel(person.displayName, person.scheduleName)}${person.isActive ? '' : ' · מושבת'}`,
    })) ?? []
  ), [workspace]);

  if (legacyRequested) {
    return <LegacyStatisticsPage />;
  }

  if (!isLoadingJobTypes && jobTypes.length === 0) {
    return <LegacyStatisticsPage />;
  }

  const viewOptions: Array<{
    value: WorkspaceView;
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
        ...(selectedJobType?.availabilityEnabled || (workspace?.availabilitySummary.periodCount ?? 0) > 0
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
                setYears([]);
                setMonths([]);
                setPeriodMode(jobType.activityTrackingEnabled && jobType.workMode==='none'?'week':'month');
                setPeriodAnchor(new Date());
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
          <StatisticsMultiSelect
            label="עובדים"
            allLabel="כל העובדים"
            selectedValues={selectedUserIds}
            options={peopleOptions}
            disabled={isLoading || !workspace}
            onChange={(values) => setSelectedUserIds(values.filter((value): value is string => typeof value === 'string'))}
          />
          <div className="statistics-compact-period">
            <span className="statistics-compact-period-label">תקופה</span>
            <div className="statistics-compact-period-control" ref={periodPickerRef}>
              <button type="button" className="statistics-period-arrow" aria-label="תקופה קודמת" onClick={()=>setPeriodAnchor(current=>shiftPeriod(periodMode,current,-1))}><ChevronRight size={18}/></button>
              <div className="statistics-period-picker">
                <button type="button" className="statistics-period-trigger" aria-haspopup="dialog" aria-expanded={isPeriodMenuOpen} onClick={()=>setIsPeriodMenuOpen(open=>!open)}>
                  <CalendarDays size={17} aria-hidden="true"/>
                  <span><small>{periodModeLabel}</small><strong>{periodLabel(periodMode,periodAnchor)}</strong></span>
                  <ChevronDown size={16} aria-hidden="true"/>
                </button>
                {isPeriodMenuOpen ? <div className="statistics-period-popover" role="dialog" aria-label="בחירת תקופת ניתוח">
                  <span>הצג לפי</span>
                  <div className="statistics-period-mode" role="group" aria-label="רמת תקופת הניתוח">
                    {availablePeriodModes.map(([value,label])=><button key={value} type="button" className={periodMode===value?'active':''} onClick={()=>{setPeriodMode(value);setIsPeriodMenuOpen(false)}}>{label}</button>)}
                  </div>
                  <div className="statistics-period-popover-current">{periodLabel(periodMode,periodAnchor)}</div>
                  <button type="button" className="statistics-period-current-button" onClick={()=>{setPeriodAnchor(new Date());setIsPeriodMenuOpen(false)}}>חזרה לתקופה הנוכחית</button>
                </div> : null}
              </div>
              <button type="button" className="statistics-period-arrow" aria-label="תקופה הבאה" onClick={()=>setPeriodAnchor(current=>shiftPeriod(periodMode,current,1))}><ChevronLeft size={18}/></button>
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

      {selectedJobTypeId && selectedJobType?.activityTrackingEnabled ? <ActivityTrackingStatistics jobTypeId={selectedJobTypeId} mode={view} selectedUserIds={selectedUserIds} rangeStart={activeRange.start} rangeEnd={activeRange.end} periodMode={periodMode} canEdit={!selectedJobType?.personalOnly} /> : null}

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
