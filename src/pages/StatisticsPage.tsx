import {
  BarChart3,
  CalendarCheck2,
  LayoutDashboard,
  RefreshCw,
  Table2,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Button, PageHeader } from '../components/ui';
import StatisticsMultiSelect from '../features/statistics/components/StatisticsMultiSelect';
import DynamicJobTypeStatisticsView from '../features/statistics/views/DynamicJobTypeStatisticsView';
import { dynamicStatisticsService } from '../services/dynamicStatisticsService';
import type {
  DynamicStatisticsJobTypeOption,
  DynamicStatisticsWorkspace,
} from '../types/dynamicStatistics';
import '../styles/statistics.css';

import LegacyStatisticsPage from './LegacyStatisticsPage';

type WorkspaceView = 'overview' | 'availability' | 'charts' | 'tables' | 'payroll';

const hebrewMonths = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

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
  }, [legacyRequested, months, refreshNonce, selectedJobTypeId, selectedUserIds, years]);

  const availableYears = useMemo(() => {
    const periodYears = workspace?.availablePeriods.map((period) => period.year) ?? [];
    return Array.from(new Set(periodYears)).sort((a, b) => b - a);
  }, [workspace]);

  const availableMonths = useMemo(() => {
    if (!workspace) {
      return [] as number[];
    }

    const periodMonths = workspace.availablePeriods
      .filter((period) => years.length === 0 || years.includes(period.year))
      .map((period) => period.month);

    return Array.from(new Set(periodMonths)).sort((a, b) => a - b);
  }, [workspace, years]);

  const peopleOptions = useMemo(() => (
    workspace?.people.map((person) => ({
      value: person.userId,
      label: `${personLabel(person.displayName, person.scheduleName)}${person.isActive ? '' : ' · מושבת'}`,
    })) ?? []
  ), [workspace]);

  const selectedJobType = jobTypes.find((jobType) => jobType.jobTypeId === selectedJobTypeId) ?? null;

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
  }> = [
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

        <div className="statistics-filters statistics-period-filters">
          <StatisticsMultiSelect
            label="עובדים"
            allLabel="כל העובדים"
            selectedValues={selectedUserIds}
            options={peopleOptions}
            disabled={isLoading || !workspace}
            onChange={(values) => {
              setSelectedUserIds(values.filter(
                (value): value is string => typeof value === 'string',
              ));
            }}
          />

          <StatisticsMultiSelect
            label="שנים"
            allLabel="כל השנים"
            selectedValues={years}
            options={availableYears.map((year) => ({ value: year, label: String(year) }))}
            disabled={isLoading || availableYears.length === 0}
            onChange={(values) => {
              setYears(values.filter(
                (value): value is number => typeof value === 'number',
              ));
              setMonths([]);
            }}
          />

          <StatisticsMultiSelect
            label="חודשים"
            allLabel="כל החודשים"
            selectedValues={months}
            options={availableMonths.map((month) => ({
              value: month,
              label: hebrewMonths[month - 1] ?? String(month),
            }))}
            disabled={isLoading || availableMonths.length === 0}
            onChange={(values) => {
              setMonths(values.filter(
                (value): value is number => typeof value === 'number',
              ));
            }}
          />
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

      {workspace ? (
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
