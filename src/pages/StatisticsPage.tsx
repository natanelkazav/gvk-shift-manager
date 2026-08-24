import {
  BarChart3,
  CalendarCheck2,
  Clock3,
  RefreshCw,
  Table2,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  useMemo,
  useState,
} from 'react';

import { useAuth } from '../auth/AuthContext';
import { Button, PageHeader } from '../components/ui';
import StatisticsMultiSelect
  from '../features/statistics/components/StatisticsMultiSelect';
import DispatcherAvailabilityInsights
  from '../features/statistics/views/DispatcherAvailabilityInsights';
import MorningDriverStatisticsView
  from '../features/statistics/views/MorningDriverStatisticsView';
import PayrollStatisticsView
  from '../features/statistics/views/PayrollStatisticsView';
import StatisticsChartsView
  from '../features/statistics/views/StatisticsChartsView';
import StatisticsTablesView
  from '../features/statistics/views/StatisticsTablesView';
import { useStatistics } from '../hooks/useStatistics';
import type {
  StatisticsDashboardResponse,
} from '../types/statistics';
import '../styles/statistics.css';

type StatisticsUserType =
  | 'dispatchers'
  | 'drivers'
  | 'morning_drivers';

type StatisticsWorkspaceView =
  | 'availability'
  | 'charts'
  | 'tables'
  | 'payroll';

const hebrewMonths = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function getPersonLabel(
  displayName: string,
  scheduleName: string | null,
): string {
  return scheduleName?.trim() || displayName.trim() || 'ללא שם';
}

function filterStatisticsData(
  data: StatisticsDashboardResponse,
  userType: StatisticsUserType,
  selectedUserIds: string[],
): StatisticsDashboardResponse {
  if (selectedUserIds.length === 0) {
    return data;
  }

  const selected = new Set(selectedUserIds);

  if (userType === 'dispatchers') {
    const dispatcherStatistics = data.dispatcherStatistics.filter(
      (row) => selected.has(row.userId),
    );
    const availability = data.dispatcherAvailabilityStatistics.filter(
      (row) => selected.has(row.userId),
    );
    const dispatcherMonthlyBreakdown = data.dispatcherMonthlyBreakdown.filter(
      (row) => selected.has(row.userId),
    );
    const availabilityMonthly = data.dispatcherAvailabilityMonthlyBreakdown.filter(
      (row) => selected.has(row.userId),
    );

    const sum = (key: keyof typeof dispatcherStatistics[number]): number =>
      dispatcherStatistics.reduce((total, row) => {
        const value = row[key];
        return total + (typeof value === 'number' ? value : 0);
      }, 0);

    const availabilitySum = (
      key: keyof typeof availability[number],
    ): number => availability.reduce((total, row) => {
      const value = row[key];
      return total + (typeof value === 'number' ? value : 0);
    }, 0);

    return {
      ...data,
      dispatcherStatistics,
      dispatcherMonthlyBreakdown,
      dispatcherAvailabilityStatistics: availability,
      dispatcherAvailabilityMonthlyBreakdown: availabilityMonthly,
      summary: {
        ...data.summary,
        dispatcherCount: dispatcherStatistics.length,
        totalDispatcherShifts: sum('totalShifts'),
        premiumShifts: sum('premiumShifts'),
        regularShifts: sum('regularShifts'),
        nightShifts: sum('nightShifts'),
        holidayShifts: sum('holidayShifts'),
        weekendShifts: sum('fridayShifts') + sum('saturdayShifts'),
      },
      dispatcherAvailabilitySummary: {
        ...data.dispatcherAvailabilitySummary,
        dispatcherCount: availability.length,
        manualSubmissionPeriods: availabilitySum('manualSubmissionPeriods'),
        autoPartialPeriods: availabilitySum('autoPartialPeriods'),
        noSubmissionPeriods: availabilitySum('noSubmissionPeriods'),
        declaredAvailableCount: availabilitySum('declaredAvailableCount'),
        declaredUnavailableCount: availabilitySum('declaredUnavailableCount'),
        autoCompletedAvailableCount: availabilitySum('autoCompletedAvailableCount'),
        fridayMorningAvailableCount: availabilitySum('fridayMorningAvailableCount'),
        nightAvailableCount: availabilitySum('nightAvailableCount'),
        premiumAvailableCount: availabilitySum('premiumAvailableCount'),
        holidayAvailableCount: availabilitySum('holidayAvailableCount'),
      },
    };
  }

  if (userType === 'drivers') {
    return {
      ...data,
      driverStatistics: data.driverStatistics.filter(
        (row) => selected.has(row.userId),
      ),
      driverMonthlyBreakdown: data.driverMonthlyBreakdown.filter(
        (row) => selected.has(row.userId),
      ),
    };
  }

  return {
    ...data,
    morningDriverStatistics: data.morningDriverStatistics.filter(
      (row) => selected.has(row.userId),
    ),
    morningDriverMonthlyBreakdown: data.morningDriverMonthlyBreakdown.filter(
      (row) => selected.has(row.userId),
    ),
  };
}

function StatisticsPage() {
  const { hasPermission } = useAuth();
  const {
    data,
    filters,
    isLoading,
    error,
    setYears,
    setMonths,
    load,
  } = useStatistics();

  const [userType, setUserType] = useState<StatisticsUserType>('dispatchers');
  const [workspaceView, setWorkspaceView] = useState<StatisticsWorkspaceView>('availability');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const canViewPayroll = hasPermission('payroll.view');

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from(
      { length: currentYear - 2020 + 2 },
      (_, index) => 2020 + index,
    );
  }, []);

  const personOptions = useMemo(() => {
    if (!data) return [];

    if (userType === 'dispatchers') {
      const people = new Map<string, { value: string; label: string }>();
      for (const row of [
        ...data.dispatcherStatistics,
        ...data.dispatcherAvailabilityStatistics,
      ]) {
        people.set(row.userId, {
          value: row.userId,
          label: getPersonLabel(row.displayName, row.scheduleName),
        });
      }
      return Array.from(people.values()).sort((a, b) =>
        a.label.localeCompare(b.label, 'he'),
      );
    }

    const rows = userType === 'drivers'
      ? data.driverStatistics
      : data.morningDriverStatistics;

    return rows.map((row) => ({
      value: row.userId,
      label: getPersonLabel(row.displayName, row.scheduleName),
    })).sort((a, b) => a.label.localeCompare(b.label, 'he'));
  }, [data, userType]);

  const filteredData = useMemo(
    () => data
      ? filterStatisticsData(data, userType, selectedUserIds)
      : null,
    [data, selectedUserIds, userType],
  );

  const personLabel =
    userType === 'dispatchers'
      ? 'מוקדנים'
      : userType === 'drivers'
        ? 'כוננים'
        : 'כונני בוקר';

  const viewOptions: Array<{
    value: StatisticsWorkspaceView;
    label: string;
    icon: typeof BarChart3;
  }> = [
    ...(userType === 'dispatchers'
      ? [{ value: 'availability' as const, label: 'אילוצים', icon: CalendarCheck2 }]
      : []),
    { value: 'charts', label: 'גרפים', icon: BarChart3 },
    { value: 'tables', label: 'טבלאות', icon: Table2 },
    ...(canViewPayroll && userType !== 'morning_drivers'
      ? [{
          value: 'payroll' as const,
          label: userType === 'dispatchers' ? 'שכר ונוכחות' : 'שכר',
          icon: userType === 'dispatchers' ? Clock3 : WalletCards,
        }]
      : []),
  ];

  return (
    <section className="statistics-page">
      <PageHeader
        title="סטטיסטיקות"
        description="בחירת אוכלוסייה, אנשים ותקופה — ואז רק הנתונים הרלוונטיים לעבודה הניהולית."
        actions={(
          <Button
            type="button"
            variant="secondary"
            disabled={isLoading}
            onClick={() => { void load(); }}
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
            <h2>על מי רוצים להסתכל?</h2>
            <p>בחירת סוג המשתמש קובעת אילו מדדים ותצוגות יוצגו.</p>
          </div>
        </header>

        <div className="statistics-user-type-grid">
          {([
            ['dispatchers', 'מוקדנים'],
            ['drivers', 'כוננים'],
            ['morning_drivers', 'כונני בוקר'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={userType === value
                ? 'statistics-user-type-card statistics-user-type-card-active'
                : 'statistics-user-type-card'}
              onClick={() => {
                setUserType(value);
                setSelectedUserIds([]);
                setWorkspaceView(value === 'dispatchers' ? 'availability' : 'charts');
              }}
            >
              <Users size={20} aria-hidden="true" />
              <strong>{label}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="statistics-workspace-step">
        <header>
          <span>שלב 2</span>
          <div>
            <h2>מי ובאיזו תקופה?</h2>
            <p>אפשר לבחור אדם אחד, כמה אנשים, כמה חודשים או כמה שנים.</p>
          </div>
        </header>

        <div className="statistics-filters statistics-period-filters">
          <StatisticsMultiSelect
            label={personLabel}
            allLabel={`כל ה${personLabel}`}
            selectedValues={selectedUserIds}
            options={personOptions}
            disabled={isLoading || !data}
            onChange={(values) => {
              setSelectedUserIds(values.filter(
                (value): value is string => typeof value === 'string',
              ));
            }}
          />

          <StatisticsMultiSelect
            label="שנים"
            allLabel="כל השנים"
            selectedValues={filters.years}
            options={availableYears.map((year) => ({ value: year, label: String(year) }))}
            disabled={isLoading}
            onChange={(values) => {
              setYears(values.filter(
                (value): value is number => typeof value === 'number',
              ));
            }}
          />

          <StatisticsMultiSelect
            label="חודשים"
            allLabel="כל החודשים"
            selectedValues={filters.months}
            options={hebrewMonths.map((label, index) => ({ value: index + 1, label }))}
            disabled={isLoading || filters.years.length === 0}
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
            <h2>איך להציג את הנתונים?</h2>
            <p>מוצגות רק תצוגות שרלוונטיות לסוג המשתמש שבחרת.</p>
          </div>
        </header>

        <div className="statistics-view-choice-grid">
          {viewOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                className={workspaceView === option.value
                  ? 'statistics-view-choice statistics-view-choice-active'
                  : 'statistics-view-choice'}
                onClick={() => setWorkspaceView(option.value)}
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

      {isLoading && !data ? (
        <div className="statistics-loading">
          <RefreshCw size={30} className="statistics-spin" aria-hidden="true" />
          <span>טוען נתוני סטטיסטיקה...</span>
        </div>
      ) : null}

      {filteredData && workspaceView === 'availability' && userType === 'dispatchers' ? (
        <DispatcherAvailabilityInsights data={filteredData} mode="dashboard" />
      ) : null}

      {filteredData && workspaceView === 'charts' && userType === 'dispatchers' ? (
        <StatisticsChartsView data={filteredData} sectionFilter="dispatchers" />
      ) : null}

      {filteredData && workspaceView === 'charts' && userType === 'drivers' ? (
        <StatisticsChartsView data={filteredData} sectionFilter="drivers" />
      ) : null}

      {filteredData && workspaceView === 'tables' && userType === 'dispatchers' ? (
        <StatisticsTablesView data={filteredData} sectionFilter="dispatchers" />
      ) : null}

      {filteredData && workspaceView === 'tables' && userType === 'drivers' ? (
        <StatisticsTablesView data={filteredData} sectionFilter="drivers" />
      ) : null}

      {filteredData && (workspaceView === 'charts' || workspaceView === 'tables') && userType === 'morning_drivers' ? (
        <MorningDriverStatisticsView
          rows={filteredData.morningDriverStatistics}
          monthlyRows={filteredData.morningDriverMonthlyBreakdown}
          mode={workspaceView}
        />
      ) : null}

      {workspaceView === 'payroll' && canViewPayroll && userType !== 'morning_drivers' ? (
        <PayrollStatisticsView
          years={filters.years}
          months={filters.months}
          dispatcherIds={userType === 'dispatchers' ? selectedUserIds : []}
          driverIds={userType === 'drivers' ? selectedUserIds : []}
          mode={userType === 'dispatchers' ? 'dispatchers' : 'drivers'}
        />
      ) : null}
    </section>
  );
}

export default StatisticsPage;
