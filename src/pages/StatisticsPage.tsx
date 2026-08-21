import {
  RefreshCw,
} from 'lucide-react';

import {
  useMemo,
  useState,
} from 'react';

import {
  useAuth,
} from '../auth/AuthContext';

import {
  Button,
  PageHeader,
} from '../components/ui';

import {
  useStatistics,
} from '../hooks/useStatistics';

import StatisticsMultiSelect
  from '../features/statistics/components/StatisticsMultiSelect';

import StatisticsViewSwitcher, {
  type StatisticsDisplayMode,
} from '../features/statistics/views/StatisticsViewSwitcher';

import StatisticsDashboardView
  from '../features/statistics/views/StatisticsDashboardView';

import StatisticsChartsView
  from '../features/statistics/views/StatisticsChartsView';

import StatisticsTablesView
  from '../features/statistics/views/StatisticsTablesView';

import PayrollStatisticsView
  from '../features/statistics/views/PayrollStatisticsView';

import type {
  StatisticsDashboardResponse,
} from '../types/statistics';

import '../styles/statistics.css';

type StatisticsSectionFilter =
  | 'all'
  | 'dispatchers'
  | 'drivers'
  | 'payroll';

const hebrewMonths = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

function getPersonLabel(
  displayName: string,
  scheduleName: string | null,
): string {
  return (
    scheduleName?.trim() ||
    displayName.trim() ||
    'ללא שם'
  );
}

function filterStatisticsData(
  data: StatisticsDashboardResponse,
  dispatcherIds: string[],
  driverIds: string[],
): StatisticsDashboardResponse {
  const dispatcherSet =
    new Set(dispatcherIds);
  const driverSet =
    new Set(driverIds);

  const dispatcherStatistics =
    dispatcherIds.length === 0
      ? data.dispatcherStatistics
      : data.dispatcherStatistics.filter(
          (row) =>
            dispatcherSet.has(
              row.userId,
            ),
        );

  const driverStatistics =
    driverIds.length === 0
      ? data.driverStatistics
      : data.driverStatistics.filter(
          (row) =>
            driverSet.has(
              row.userId,
            ),
        );

  const dispatcherMonthlyBreakdown =
    dispatcherIds.length === 0
      ? data.dispatcherMonthlyBreakdown
      : data.dispatcherMonthlyBreakdown.filter(
          (row) =>
            dispatcherSet.has(
              row.userId,
            ),
        );

  const driverMonthlyBreakdown =
    driverIds.length === 0
      ? data.driverMonthlyBreakdown
      : data.driverMonthlyBreakdown.filter(
          (row) =>
            driverSet.has(
              row.userId,
            ),
        );

  const monthlyStatistics =
    data.monthlyStatistics.map(
      (row) => ({
        ...row,
        dispatcherShiftCount:
          dispatcherMonthlyBreakdown
            .filter(
              (item) =>
                item.year === row.year &&
                item.month === row.month,
            )
            .reduce(
              (sum, item) =>
                sum + item.totalShifts,
              0,
            ),
        driverDutyCount:
          driverMonthlyBreakdown
            .filter(
              (item) =>
                item.year === row.year &&
                item.month === row.month,
            )
            .reduce(
              (sum, item) =>
                sum + item.totalDuties,
              0,
            ),
      }),
    );

  const sumDispatcher = (
    key:
      | 'totalShifts'
      | 'premiumShifts'
      | 'regularShifts'
      | 'fridayShifts'
      | 'saturdayShifts'
      | 'holidayShifts'
      | 'nightShifts',
  ): number =>
    dispatcherStatistics.reduce(
      (sum, row) =>
        sum + row[key],
      0,
    );

  const sumDriver = (
    key:
      | 'totalDuties'
      | 'weekdayDuties'
      | 'weekendDuties'
      | 'holidayDuties',
  ): number =>
    driverStatistics.reduce(
      (sum, row) =>
        sum + row[key],
      0,
    );

  return {
    ...data,
    summary: {
      ...data.summary,
      dispatcherCount:
        dispatcherStatistics.length,
      driverCount:
        driverStatistics.length,
      totalDispatcherShifts:
        sumDispatcher(
          'totalShifts',
        ),
      totalDriverDuties:
        sumDriver(
          'totalDuties',
        ),
      premiumShifts:
        sumDispatcher(
          'premiumShifts',
        ),
      regularShifts:
        sumDispatcher(
          'regularShifts',
        ),
      nightShifts:
        sumDispatcher(
          'nightShifts',
        ),
      holidayShifts:
        sumDispatcher(
          'holidayShifts',
        ),
      weekendShifts:
        sumDispatcher(
          'fridayShifts',
        ) +
        sumDispatcher(
          'saturdayShifts',
        ),
      weekdayDriverDuties:
        sumDriver(
          'weekdayDuties',
        ),
      weekendDriverDuties:
        sumDriver(
          'weekendDuties',
        ),
      holidayDriverDuties:
        sumDriver(
          'holidayDuties',
        ),
    },
    dispatcherStatistics,
    driverStatistics,
    monthlyStatistics,
    dispatcherMonthlyBreakdown,
    driverMonthlyBreakdown,
  };
}

function StatisticsPage() {
  const {
    hasPermission,
  } = useAuth();

  const {
    data,
    filters,
    isLoading,
    error,
    setYears,
    setMonths,
    load,
  } = useStatistics();

  const [
    sectionFilter,
    setSectionFilter,
  ] = useState<StatisticsSectionFilter>(
    'all',
  );

  const [
    displayMode,
    setDisplayMode,
  ] = useState<StatisticsDisplayMode>(
    'dashboard',
  );

  const [
    selectedDispatcherIds,
    setSelectedDispatcherIds,
  ] = useState<string[]>([]);

  const [
    selectedDriverIds,
    setSelectedDriverIds,
  ] = useState<string[]>([]);

  const canViewPayroll =
    hasPermission(
      'payroll.view',
    );

  const availableYears =
    useMemo(() => {
      const currentYear =
        new Date().getFullYear();

      return Array.from(
        {
          length:
            currentYear - 2020 + 2,
        },
        (_, index) =>
          2020 + index,
      );
    }, []);

  const yearOptions =
    availableYears.map(
      (year) => ({
        value: year,
        label: String(year),
      }),
    );

  const monthOptions =
    hebrewMonths.map(
      (monthName, index) => ({
        value: index + 1,
        label: monthName,
      }),
    );

  const dispatcherOptions =
    useMemo(
      () =>
        data?.dispatcherStatistics.map(
          (row) => ({
            value: row.userId,
            label: getPersonLabel(
              row.displayName,
              row.scheduleName,
            ),
          }),
        ) ?? [],
      [data],
    );

  const driverOptions =
    useMemo(
      () =>
        data?.driverStatistics.map(
          (row) => ({
            value: row.userId,
            label: getPersonLabel(
              row.displayName,
              row.scheduleName,
            ),
          }),
        ) ?? [],
      [data],
    );

  const filteredData =
    useMemo(
      () =>
        data
          ? filterStatisticsData(
              data,
              selectedDispatcherIds,
              selectedDriverIds,
            )
          : null,
      [
        data,
        selectedDispatcherIds,
        selectedDriverIds,
      ],
    );

  const periodLabel =
    useMemo(() => {
      const yearsLabel =
        filters.years.length === 0
          ? 'כל השנים'
          : filters.years.join(', ');

      const monthsLabel =
        filters.months.length === 0
          ? 'כל החודשים'
          : filters.months
              .map(
                (month) =>
                  hebrewMonths[
                    month - 1
                  ],
              )
              .join(', ');

      if (
        filters.years.length === 0
      ) {
        return 'כל התקופה';
      }

      return `${monthsLabel} | ${yearsLabel}`;
    }, [filters.months, filters.years]);

  const sectionOptions = [
    {
      value: 'all' as const,
      label: 'הכול',
    },
    {
      value: 'dispatchers' as const,
      label: 'מוקדנים',
    },
    {
      value: 'drivers' as const,
      label: 'כוננים',
    },
    ...(canViewPayroll
      ? [
          {
            value: 'payroll' as const,
            label: 'שכר ונוכחות',
          },
        ]
      : []),
  ];

  const showDispatcherFilter =
    sectionFilter === 'all' ||
    sectionFilter === 'dispatchers' ||
    sectionFilter === 'payroll';

  const showDriverFilter =
    sectionFilter === 'all' ||
    sectionFilter === 'drivers' ||
    sectionFilter === 'payroll';

  return (
    <section className="statistics-page">
      <PageHeader
        title="סטטיסטיקות"
        description="נתוני משמרות, כוננויות, מגמות, חלוקת עבודה ושכר צפוי לפי הרשאה."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={isLoading}
            onClick={() => {
              void load();
            }}
          >
            <RefreshCw
              size={17}
              className={
                isLoading
                  ? 'statistics-spin'
                  : undefined
              }
              aria-hidden="true"
            />

            {isLoading
              ? 'טוען...'
              : 'רענון'}
          </Button>
        }
      />

      <section className="statistics-filter-panel">
        <div className="statistics-filter-panel-heading">
          <div>
            <span>תקופה נבחרת</span>
            <strong>{periodLabel}</strong>
          </div>

          <small>
            כל הכרטיסים, הגרפים והטבלאות מתעדכנים לפי הבחירה.
          </small>
        </div>

        <div className="statistics-filters statistics-period-filters">
          <StatisticsMultiSelect
            label="שנים"
            allLabel="כל השנים"
            selectedValues={
              filters.years
            }
            options={yearOptions}
            disabled={isLoading}
            onChange={(values) => {
              setYears(
                values.filter(
                  (value): value is number =>
                    typeof value === 'number',
                ),
              );
            }}
          />

          <StatisticsMultiSelect
            label="חודשים"
            allLabel="כל החודשים"
            selectedValues={
              filters.months
            }
            options={monthOptions}
            disabled={
              isLoading ||
              filters.years.length === 0
            }
            onChange={(values) => {
              setMonths(
                values.filter(
                  (value): value is number =>
                    typeof value === 'number',
                ),
              );
            }}
          />

          {showDispatcherFilter ? (
            <StatisticsMultiSelect
              label="מוקדנים"
              allLabel="כל המוקדנים"
              selectedValues={
                selectedDispatcherIds
              }
              options={dispatcherOptions}
              disabled={
                isLoading ||
                !data
              }
              onChange={(values) => {
                setSelectedDispatcherIds(
                  values.filter(
                    (value): value is string =>
                      typeof value === 'string',
                  ),
                );
              }}
            />
          ) : null}

          {showDriverFilter ? (
            <StatisticsMultiSelect
              label="כוננים"
              allLabel="כל הכוננים"
              selectedValues={
                selectedDriverIds
              }
              options={driverOptions}
              disabled={
                isLoading ||
                !data
              }
              onChange={(values) => {
                setSelectedDriverIds(
                  values.filter(
                    (value): value is string =>
                      typeof value === 'string',
                  ),
                );
              }}
            />
          ) : null}
        </div>

        {filters.years.length === 0 ? (
          <div className="statistics-filter-note">
            בחירת חודשים ספציפיים זמינה לאחר בחירת שנה אחת או יותר. כאשר נבחרות "כל השנים", מוצגת כל התקופה.
          </div>
        ) : null}

        <div className="statistics-filter-selection-summary">
          {showDispatcherFilter ? (
            <span>
              מוקדנים:{' '}
              <strong>
                {selectedDispatcherIds.length === 0
                  ? 'כולם'
                  : `${selectedDispatcherIds.length} נבחרו`}
              </strong>
            </span>
          ) : null}

          {showDriverFilter ? (
            <span>
              כוננים:{' '}
              <strong>
                {selectedDriverIds.length === 0
                  ? 'כולם'
                  : `${selectedDriverIds.length} נבחרו`}
              </strong>
            </span>
          ) : null}
        </div>
      </section>

      <div className="statistics-toolbar">
        <section
          className="statistics-section-filter"
          aria-label="סינון סוג סטטיסטיקה"
        >
          {sectionOptions.map(
            (option) => (
              <button
                key={option.value}
                type="button"
                className={
                  sectionFilter === option.value
                    ? 'statistics-section-filter-button statistics-section-filter-button-active'
                    : 'statistics-section-filter-button'
                }
                aria-pressed={
                  sectionFilter === option.value
                }
                onClick={() => {
                  setSectionFilter(
                    option.value,
                  );
                }}
              >
                {option.label}
              </button>
            ),
          )}
        </section>

        {sectionFilter !== 'payroll' ? (
          <StatisticsViewSwitcher
            value={displayMode}
            onChange={setDisplayMode}
          />
        ) : null}
      </div>

      {error ? (
        <div
          className="statistics-error"
          role="alert"
        >
          <strong>
            לא ניתן היה לטעון את הסטטיסטיקות
          </strong>

          <span>{error}</span>
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="statistics-loading">
          <RefreshCw
            size={30}
            className="statistics-spin"
            aria-hidden="true"
          />

          <span>
            טוען נתוני סטטיסטיקה...
          </span>
        </div>
      ) : null}

      {sectionFilter === 'payroll' &&
      canViewPayroll ? (
        <PayrollStatisticsView
          years={filters.years}
          months={filters.months}
          dispatcherIds={
            selectedDispatcherIds
          }
          driverIds={
            selectedDriverIds
          }
        />
      ) : null}

      {filteredData &&
      sectionFilter !== 'payroll' ? (
        <>
          {displayMode === 'dashboard' ? (
            <StatisticsDashboardView
              data={filteredData}
              sectionFilter={
                sectionFilter
              }
            />
          ) : null}

          {displayMode === 'charts' ? (
            <StatisticsChartsView
              data={filteredData}
              sectionFilter={
                sectionFilter
              }
            />
          ) : null}

          {displayMode === 'tables' ? (
            <StatisticsTablesView
              data={filteredData}
              sectionFilter={
                sectionFilter
              }
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default StatisticsPage;
