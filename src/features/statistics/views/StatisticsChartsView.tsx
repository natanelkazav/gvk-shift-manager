import type {
  StatisticsDashboardResponse,
} from '../../../types/statistics';

import StatisticsBarChart
  from '../components/StatisticsBarChart';

import StatisticsPieChart
  from '../components/StatisticsPieChart';

import StatisticsTrendChart
  from '../components/StatisticsTrendChart';

interface StatisticsChartsViewProps {
  data:
    StatisticsDashboardResponse;

  sectionFilter:
    'all'
    | 'dispatchers'
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

function StatisticsChartsView({
  data,
  sectionFilter,
}: StatisticsChartsViewProps) {
  const monthLabel = (
    year: number,
    month: number,
  ): string =>
    `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;

  return (
    <section className="statistics-charts-grid">
      {sectionFilter !==
      'drivers' ? (
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

      {sectionFilter !==
      'dispatchers' ? (
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

          <StatisticsTrendChart
            title="מגמת כוננויות לאורך זמן"
            description="מספר הכוננויות בכל חודש בתקופה שנבחרה."
            points={
              data.monthlyStatistics.map(
                (row) => ({
                  label: monthLabel(
                    row.year,
                    row.month,
                  ),
                  value:
                    row.driverDutyCount,
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
    </section>
  );
}

export default StatisticsChartsView;