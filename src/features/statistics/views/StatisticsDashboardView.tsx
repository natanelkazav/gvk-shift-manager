import {
  CalendarDays,
  Car,
  Crown,
  Moon,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';

import type {
  StatisticsDashboardResponse,
} from '../../../types/statistics';

import StatisticsBarChart
  from '../components/StatisticsBarChart';

import StatisticsPieChart
  from '../components/StatisticsPieChart';

import DispatcherAvailabilityInsights
  from './DispatcherAvailabilityInsights';

interface StatisticsDashboardViewProps {
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

function StatisticsDashboardView({
  data,
  sectionFilter,
}: StatisticsDashboardViewProps) {
  const dispatcherLeader =
    data.dispatcherStatistics[0] ??
    null;

  const driverLeader =
    data.driverStatistics[0] ??
    null;

  return (
    <div className="statistics-dashboard-view">
      {sectionFilter ===
      'all' ? (
        <section className="statistics-summary-grid">
          <article>
            <CalendarDays
              size={22}
              aria-hidden="true"
            />

            <div>
              <span>
                משמרות מוקדנים
              </span>

              <strong>
                {
                  data.summary
                    .totalDispatcherShifts
                }
              </strong>
            </div>
          </article>

          <article>
            <Car
              size={22}
              aria-hidden="true"
            />

            <div>
              <span>
                כוננויות
              </span>

              <strong>
                {
                  data.summary
                    .totalDriverDuties
                }
              </strong>
            </div>
          </article>

          <article>
            <Sparkles
              size={22}
              aria-hidden="true"
            />

            <div>
              <span>
                משמרות 200%
              </span>

              <strong>
                {
                  data.summary
                    .premiumShifts
                }
              </strong>
            </div>
          </article>

          <article>
            <Moon
              size={22}
              aria-hidden="true"
            />

            <div>
              <span>
                משמרות לילה
              </span>

              <strong>
                {
                  data.summary
                    .nightShifts
                }
              </strong>
            </div>
          </article>

          <article>
            <Users
              size={22}
              aria-hidden="true"
            />

            <div>
              <span>
                מוקדנים פעילים
              </span>

              <strong>
                {
                  data.summary
                    .dispatcherCount
                }
              </strong>
            </div>
          </article>

          <article>
            <Crown
              size={22}
              aria-hidden="true"
            />

            <div>
              <span>
                כוננים פעילים
              </span>

              <strong>
                {
                  data.summary
                    .driverCount
                }
              </strong>
            </div>
          </article>
        </section>
      ) : null}

      <section className="statistics-leaders-grid">
        {(sectionFilter === 'all' ||
        sectionFilter === 'dispatchers') ? (
          <article>
            <Trophy
              size={23}
              aria-hidden="true"
            />

            <div>
              <span>
                מוביל במשמרות
              </span>

              <strong>
                {dispatcherLeader
                  ? getDisplayName(
                      dispatcherLeader
                        .displayName,
                      dispatcherLeader
                        .scheduleName,
                    )
                  : 'אין נתונים'}
              </strong>

              <small>
                {dispatcherLeader
                  ? `${dispatcherLeader.totalShifts} משמרות`
                  : ''}
              </small>
            </div>
          </article>
        ) : null}

        {(sectionFilter === 'all' ||
        sectionFilter === 'drivers') ? (
          <article>
            <Car
              size={23}
              aria-hidden="true"
            />

            <div>
              <span>
                מוביל בכוננויות
              </span>

              <strong>
                {driverLeader
                  ? getDisplayName(
                      driverLeader
                        .displayName,
                      driverLeader
                        .scheduleName,
                    )
                  : 'אין נתונים'}
              </strong>

              <small>
                {driverLeader
                  ? `${driverLeader.totalDuties} כוננויות`
                  : ''}
              </small>
            </div>
          </article>
        ) : null}
      </section>

      <section className="statistics-charts-grid">
        {(sectionFilter === 'all' ||
        sectionFilter === 'dispatchers') ? (
          <>
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
              title="השוואת מוקדנים"
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

            <StatisticsBarChart
              title="השוואת כוננים"
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
      {(sectionFilter === 'all' ||
        sectionFilter === 'availability') ? (
        <DispatcherAvailabilityInsights
          data={data}
          mode="dashboard"
        />
      ) : null}
    </div>
  );
}

export default StatisticsDashboardView;