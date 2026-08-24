import type {
  StatisticsDashboardResponse,
} from '../../../types/statistics';

import DispatcherAvailabilityInsights
  from './DispatcherAvailabilityInsights';

interface StatisticsTablesViewProps {
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

function StatisticsTablesView({
  data,
  sectionFilter,
}: StatisticsTablesViewProps) {
  return (
    <div className="statistics-tables-view">
      {(sectionFilter === 'all' ||
      sectionFilter === 'dispatchers') ? (
        <section className="statistics-section">
          <header>
            <div>
              <div>
                <h2>
                  סטטיסטיקות מוקדנים
                </h2>

                <p>
                  חלוקת המשמרות לפי
                  מוקדן וסוג משמרת.
                </p>
              </div>
            </div>
          </header>

          <div className="statistics-table-wrapper">
            <table className="statistics-table">
              <thead>
                <tr>
                  <th>
                    מוקדן
                  </th>

                  <th>
                    סה״כ
                  </th>

                  <th>
                    רגילות
                  </th>

                  <th>
                    200%
                  </th>

                  <th>
                    ימי חול
                  </th>

                  <th>
                    שישי
                  </th>

                  <th>
                    שבת
                  </th>

                  <th>
                    חג
                  </th>

                  <th>
                    לילה
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.dispatcherStatistics.map(
                  (
                    dispatcher,
                  ) => (
                    <tr
                      key={
                        dispatcher
                          .userId
                      }
                    >
                      <td>
                        <strong>
                          {getDisplayName(
                            dispatcher
                              .displayName,
                            dispatcher
                              .scheduleName,
                          )}
                        </strong>
                      </td>

                      <td>
                        {
                          dispatcher
                            .totalShifts
                        }
                      </td>

                      <td>
                        {
                          dispatcher
                            .regularShifts
                        }
                      </td>

                      <td>
                        {
                          dispatcher
                            .premiumShifts
                        }
                      </td>

                      <td>
                        {
                          dispatcher
                            .weekdayShifts
                        }
                      </td>

                      <td>
                        {
                          dispatcher
                            .fridayShifts
                        }
                      </td>

                      <td>
                        {
                          dispatcher
                            .saturdayShifts
                        }
                      </td>

                      <td>
                        {
                          dispatcher
                            .holidayShifts
                        }
                      </td>

                      <td>
                        {
                          dispatcher
                            .nightShifts
                        }
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {(sectionFilter === 'all' ||
      sectionFilter === 'drivers') ? (
        <section className="statistics-section">
          <header>
            <div>
              <div>
                <h2>
                  סטטיסטיקות כוננים
                </h2>

                <p>
                  חלוקת הכוננויות לפי
                  כונן וסוג יום.
                </p>
              </div>
            </div>
          </header>

          <div className="statistics-table-wrapper">
            <table className="statistics-table">
              <thead>
                <tr>
                  <th>
                    כונן
                  </th>

                  <th>
                    סה״כ
                  </th>

                  <th>
                    ימי חול
                  </th>

                  <th>
                    שישי
                  </th>

                  <th>
                    שבת
                  </th>

                  <th>
                    סוף שבוע
                  </th>

                  <th>
                    חג
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.driverStatistics.map(
                  (
                    driver,
                  ) => (
                    <tr
                      key={
                        driver
                          .userId
                      }
                    >
                      <td>
                        <strong>
                          {getDisplayName(
                            driver
                              .displayName,
                            driver
                              .scheduleName,
                          )}
                        </strong>
                      </td>

                      <td>
                        {
                          driver
                            .totalDuties
                        }
                      </td>

                      <td>
                        {
                          driver
                            .weekdayDuties
                        }
                      </td>

                      <td>
                        {
                          driver
                            .fridayDuties
                        }
                      </td>

                      <td>
                        {
                          driver
                            .saturdayDuties
                        }
                      </td>

                      <td>
                        {
                          driver
                            .weekendDuties
                        }
                      </td>

                      <td>
                        {
                          driver
                            .holidayDuties
                        }
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {(sectionFilter === 'all' ||
        sectionFilter === 'availability') ? (
        <DispatcherAvailabilityInsights
          data={data}
          mode="tables"
        />
      ) : null}
    </div>
  );
}

export default StatisticsTablesView;