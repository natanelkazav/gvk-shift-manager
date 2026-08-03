import {
  RefreshCw,
} from 'lucide-react';

import {
  useMemo,
  useState,
} from 'react';

import {
  Button,
  PageHeader,
} from '../components/ui';

import {
  useStatistics,
} from '../hooks/useStatistics';

import StatisticsViewSwitcher, {
  type StatisticsDisplayMode,
} from '../features/statistics/views/StatisticsViewSwitcher';

import StatisticsDashboardView
  from '../features/statistics/views/StatisticsDashboardView';

import StatisticsChartsView
  from '../features/statistics/views/StatisticsChartsView';

import StatisticsTablesView
  from '../features/statistics/views/StatisticsTablesView';

import '../styles/statistics.css';

type StatisticsSectionFilter =
  | 'all'
  | 'dispatchers'
  | 'drivers';

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
    data,
    filters,
    isLoading,
    error,
    setYear,
    setMonth,
    load,
  } =
    useStatistics();

  const [
    sectionFilter,
    setSectionFilter,
  ] =
    useState<StatisticsSectionFilter>(
      'all',
    );

  const [
    displayMode,
    setDisplayMode,
  ] =
    useState<StatisticsDisplayMode>(
      'dashboard',
    );

  const availableYears =
    useMemo(
      () => {
        const currentYear =
          new Date()
            .getFullYear();

        return Array.from(
          {
            length: 7,
          },
          (
            _,
            index,
          ) =>
            currentYear -
            5 +
            index,
        );
      },
      [],
    );

  const periodLabel =
    filters.year ===
      null
      ? 'כל התקופה'
      : filters.month ===
          null
        ? `שנת ${filters.year}`
        : `${hebrewMonths[
            filters.month - 1
          ]} ${filters.year}`;

  return (
    <section className="statistics-page">
      <PageHeader
        title="סטטיסטיקות"
        description="נתוני משמרות, כוננויות, מגמות וחלוקת עבודה."
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={
              isLoading
            }
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

        <label>
          <span>
            שנה
          </span>

          <select
            value={
              filters.year ??
              ''
            }
            disabled={
              isLoading
            }
            onChange={(
              event,
            ) => {
              const value =
                event.target
                  .value;

              setYear(
                value
                  ? Number(
                      value,
                    )
                  : null,
              );
            }}
          >
            <option value="">
              כל השנים
            </option>

            {availableYears.map(
              (
                year,
              ) => (
                <option
                  key={
                    year
                  }
                  value={
                    year
                  }
                >
                  {year}
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          <span>
            חודש
          </span>

          <select
            value={
              filters.month ??
              ''
            }
            disabled={
              isLoading ||
              filters.year ===
                null
            }
            onChange={(
              event,
            ) => {
              const value =
                event.target
                  .value;

              setMonth(
                value
                  ? Number(
                      value,
                    )
                  : null,
              );
            }}
          >
            <option value="">
              כל השנה
            </option>

            {hebrewMonths.map(
              (
                monthName,
                index,
              ) => (
                <option
                  key={
                    monthName
                  }
                  value={
                    index + 1
                  }
                >
                  {monthName}
                </option>
              ),
            )}
          </select>
        </label>
      </section>

      <div className="statistics-toolbar">
        <section
          className="statistics-section-filter"
          aria-label="סינון סוג סטטיסטיקה"
        >
          {[
            {
              value:
                'all' as const,

              label:
                'הכול',
            },
            {
              value:
                'dispatchers' as const,

              label:
                'מוקדנים',
            },
            {
              value:
                'drivers' as const,

              label:
                'כוננים',
            },
          ].map(
            (
              option,
            ) => (
              <button
                key={
                  option.value
                }
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
                {
                  option.label
                }
              </button>
            ),
          )}
        </section>

        <StatisticsViewSwitcher
          value={
            displayMode
          }
          onChange={
            setDisplayMode
          }
        />
      </div>

      {error ? (
        <div
          className="statistics-error"
          role="alert"
        >
          <strong>
            לא ניתן היה לטעון את
            הסטטיסטיקות
          </strong>

          <span>
            {error}
          </span>
        </div>
      ) : null}

      {isLoading &&
      !data ? (
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

      {data ? (
        <>
          {displayMode ===
          'dashboard' ? (
            <StatisticsDashboardView
              data={
                data
              }
              sectionFilter={
                sectionFilter
              }
            />
          ) : null}

          {displayMode ===
          'charts' ? (
            <StatisticsChartsView
              data={
                data
              }
              sectionFilter={
                sectionFilter
              }
            />
          ) : null}

          {displayMode ===
          'tables' ? (
            <StatisticsTablesView
              data={
                data
              }
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