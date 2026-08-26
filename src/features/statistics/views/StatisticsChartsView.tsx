import type {
  StatisticsDashboardResponse,
} from '../../../types/statistics';

import StatisticsBarChart
  from '../components/StatisticsBarChart';

import StatisticsPieChart
  from '../components/StatisticsPieChart';

import StatisticsTrendChart
  from '../components/StatisticsTrendChart';

import StatisticsGroupedBarChart
  from '../components/StatisticsGroupedBarChart';

import StatisticsStackedBarChart
  from '../components/StatisticsStackedBarChart';

import DispatcherAvailabilityInsights
  from './DispatcherAvailabilityInsights';

interface StatisticsChartsViewProps {
  data:
    StatisticsDashboardResponse;

  sectionFilter:
    'all'
    | 'dispatchers'
    | 'availability'
    | 'drivers';
}

function getDisplayName(
  displayName: string,
  scheduleName:
    string | null,
): string {
  return (
    scheduleName?.trim() ||
    displayName.trim() ||
    'ללא שם'
  );
}

function shiftTimeStartMinutes(
  shiftTime: string,
): number {
  const start = shiftTime.split('–')[0] ?? shiftTime.split('-')[0] ?? '';
  const [hours, minutes] = start.split(':').map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.MAX_SAFE_INTEGER;
  }

  return (hours * 60) + minutes;
}

function buildShiftTimeSeries(
  rows: StatisticsDashboardResponse['dispatcherShiftTimeDistribution'],
) {
  return Array.from(
    new Set(rows.map((row) => row.shiftTime)),
  )
    .sort((first, second) =>
      shiftTimeStartMinutes(first) - shiftTimeStartMinutes(second) ||
      first.localeCompare(second),
    )
    .map((shiftTime) => ({
      key: shiftTime,
      label: shiftTime,
    }));
}

function buildShiftTimeItems(
  rows: StatisticsDashboardResponse['dispatcherShiftTimeDistribution'],
) {
  const items = new Map<
    string,
    {
      key: string;
      label: string;
      values: Record<string, number>;
    }
  >();

  for (const row of rows) {
    const current = items.get(row.userId) ?? {
      key: row.userId,
      label: getDisplayName(row.displayName, row.scheduleName),
      values: {},
    };

    current.values[row.shiftTime] =
      (current.values[row.shiftTime] ?? 0) + row.shiftCount;

    items.set(row.userId, current);
  }

  return Array.from(items.values()).sort(
    (first, second) => first.label.localeCompare(second.label, 'he'),
  );
}

function StatisticsChartsView({
  data,
  sectionFilter,
}: StatisticsChartsViewProps) {
  const monthLabel = (
    year: number,
    month: number,
  ): string =>
    `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;

  const dispatcherPremiumTrend =
    data.monthlyStatistics.map(
      (monthRow) => ({
        label: monthLabel(
          monthRow.year,
          monthRow.month,
        ),
        value:
          data.dispatcherMonthlyBreakdown
            .filter(
              (row) =>
                row.year ===
                  monthRow.year &&
                row.month ===
                  monthRow.month,
            )
            .reduce(
              (sum, row) =>
                sum +
                row.premiumShifts,
              0,
            ),
      }),
    );



  const dispatcherShiftTimeSeries =
    buildShiftTimeSeries(data.dispatcherShiftTimeDistribution);

  const dispatcherShiftTimeItems =
    buildShiftTimeItems(data.dispatcherShiftTimeDistribution);

  return (
    <section className="statistics-charts-grid">
      {(sectionFilter === 'all' ||
      sectionFilter === 'dispatchers') ? (
        <>
          <StatisticsPieChart
            title="חלוקת משמרות לפי סוג"
            slices={[
              {
                label:
                  'ימי חול',

                value:
                  data.dispatcherStatistics.reduce(
                    (
                      sum,
                      row,
                    ) =>
                      sum +
                      row.weekdayShifts,
                    0,
                  ),
              },
              {
                label:
                  'שישי',

                value:
                  data.dispatcherStatistics.reduce(
                    (
                      sum,
                      row,
                    ) =>
                      sum +
                      row.fridayShifts,
                    0,
                  ),
              },
              {
                label:
                  'שבת',

                value:
                  data.dispatcherStatistics.reduce(
                    (
                      sum,
                      row,
                    ) =>
                      sum +
                      row.saturdayShifts,
                    0,
                  ),
              },
              {
                label:
                  'חגים',

                value:
                  data.summary
                    .holidayShifts,
              },
            ]}
          />

          <StatisticsPieChart
            title="רגילות מול 200%"
            slices={[
              {
                label:
                  'רגילות',

                value:
                  data.summary
                    .regularShifts,
              },
              {
                label:
                  '200%',

                value:
                  data.summary
                    .premiumShifts,
              },
            ]}
          />

          <StatisticsBarChart
            title="סך משמרות לפי מוקדן"
            items={
              data.dispatcherStatistics.map(
                (
                  dispatcher,
                ) => ({
                  label:
                    getDisplayName(
                      dispatcher
                        .displayName,
                      dispatcher
                        .scheduleName,
                    ),

                  value:
                    dispatcher
                      .totalShifts,
                }),
              )
            }
          />

          <StatisticsStackedBarChart
            title="הרכב המשמרות לפי מוקדן"
            description="גובה העמודה הוא מספר המשמרות הכולל. כל צבע מייצג שעות משמרת אחרות, וניתן להסתיר או להחזיר שעות באמצעות תיבות הסימון."
            series={dispatcherShiftTimeSeries}
            items={dispatcherShiftTimeItems}
          />

          <StatisticsTrendChart
            title="מגמת משמרות לאורך זמן"
            description="מספר משמרות המוקדנים בכל חודש בתקופה שנבחרה."
            points={
              data.monthlyStatistics.map(
                (row) => ({
                  label: monthLabel(
                    row.year,
                    row.month,
                  ),
                  value:
                    row.dispatcherShiftCount,
                }),
              )
            }
          />

          {data.monthlyStatistics.length >
          1 ? (
            <StatisticsTrendChart
              title="מגמת משמרות 200% לפי חודש"
              description="כמה משמרות 200% בוצעו בכל חודש עבור המוקדנים שנבחרו."
              points={
                dispatcherPremiumTrend
              }
            />
          ) : null}

          <StatisticsBarChart
            title="משמרות 200% לפי מוקדן"
            items={
              data.dispatcherStatistics.map(
                (dispatcher) => ({
                  label:
                    getDisplayName(
                      dispatcher.displayName,
                      dispatcher.scheduleName,
                    ),
                  value:
                    dispatcher.premiumShifts,
                }),
              )
            }
          />

          <StatisticsBarChart
            title="משמרות לילה לפי מוקדן"
            items={
              data.dispatcherStatistics.map(
                (
                  dispatcher,
                ) => ({
                  label:
                    getDisplayName(
                      dispatcher
                        .displayName,
                      dispatcher
                        .scheduleName,
                    ),

                  value:
                    dispatcher
                      .nightShifts,
                }),
              )
            }
          />
        </>
      ) : null}

      {(sectionFilter === 'all' ||
      sectionFilter === 'drivers') ? (
        <>
          <StatisticsPieChart
            title="חלוקת כוננויות"
            slices={[
              {
                label:
                  'ימי חול',

                value:
                  data.summary
                    .weekdayDriverDuties,
              },
              {
                label:
                  'סופי שבוע',

                value:
                  data.summary
                    .weekendDriverDuties,
              },
            ]}
          />

          <StatisticsGroupedBarChart
            title="התפלגות שישי, שבת וחגים לפי כונן"
            description="השוואת חלוקת הכוננויות המיוחדות בין הכוננים שנבחרו."
            series={[
              {
                key: 'friday',
                label: 'שישי',
              },
              {
                key: 'saturday',
                label: 'שבת',
              },
              {
                key: 'holiday',
                label: 'חגים',
              },
            ]}
            items={
              data.driverStatistics.map(
                (driver) => ({
                  label:
                    getDisplayName(
                      driver.displayName,
                      driver.scheduleName,
                    ),
                  values: {
                    friday:
                      driver.fridayDuties,
                    saturday:
                      driver.saturdayDuties,
                    holiday:
                      driver.holidayDuties,
                  },
                }),
              )
            }
          />

          <StatisticsBarChart
            title="כוננויות סופ״ש לפי כונן"
            items={
              data.driverStatistics.map(
                (driver) => ({
                  label:
                    getDisplayName(
                      driver.displayName,
                      driver.scheduleName,
                    ),
                  value:
                    driver.weekendDuties,
                }),
              )
            }
          />

          <StatisticsBarChart
            title="סך כוננויות לפי כונן"
            items={
              data.driverStatistics.map(
                (
                  driver,
                ) => ({
                  label:
                    getDisplayName(
                      driver
                        .displayName,
                      driver
                        .scheduleName,
                    ),

                  value:
                    driver
                      .totalDuties,
                }),
              )
            }
          />
        </>
      ) : null}
      {(sectionFilter === 'all' ||
        sectionFilter === 'availability') ? (
        <DispatcherAvailabilityInsights
          data={data}
          mode="charts"
        />
      ) : null}
    </section>
  );
}

export default StatisticsChartsView;