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

      <section className="statistics-filters">
        <div>
          <span>
            תקופה נבחרת
          </span>

          <strong>
            {periodLabel}
          </strong>
        </div>

        <StatisticsMultiSelect
          label="שנים"
          allLabel="כל השנים"
          selectedValues={
            filters.years
          }
          options={yearOptions}
          disabled={isLoading}
          onChange={setYears}
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
          onChange={setMonths}
        />
      </section>

      {filters.years.length === 0 ? (
        <div className="statistics-filter-note">
          בחירת חודשים ספציפיים זמינה לאחר בחירת שנה אחת או יותר. כאשר נבחרות "כל השנים", מוצגת כל התקופה.
        </div>
      ) : null}

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
                  sectionFilter ===
                  option.value
                    ? 'statistics-section-filter-button statistics-section-filter-button-active'
                    : 'statistics-section-filter-button'
                }
                aria-pressed={
                  sectionFilter ===
                  option.value
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
        />
      ) : null}

      {data &&
      sectionFilter !== 'payroll' ? (
        <>
          {displayMode ===
          'dashboard' ? (
            <StatisticsDashboardView
              data={data}
              sectionFilter={
                sectionFilter
              }
            />
          ) : null}

          {displayMode ===
          'charts' ? (
            <StatisticsChartsView
              data={data}
              sectionFilter={
                sectionFilter
              }
            />
          ) : null}

          {displayMode ===
          'tables' ? (
            <StatisticsTablesView
              data={data}
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
