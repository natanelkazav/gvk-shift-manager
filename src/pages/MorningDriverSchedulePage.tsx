import {
  CalendarDays,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useAuth,
} from '../auth/AuthContext';

import MorningDriverScheduleBoard
  from '../components/morningDriverSchedule/MorningDriverScheduleBoard';

import MorningDriverAssignmentTransferDialog
  from '../components/morningDriverSchedule/MorningDriverAssignmentTransferDialog';

import {
  useMorningDriverAvailabilityPeriods,
} from '../hooks/useMorningDriverAvailabilityPeriods';

import {
  useMorningDriverSchedule,
} from '../hooks/useMorningDriverSchedule';

import type {
  MorningDriverAvailabilityPeriodListItem,
} from '../types/morningDriverAvailability';

import type {
  MorningDriverScheduleAssignment,
} from '../types/morningDriverSchedule';

import '../styles/morningDriverSchedule.css';

const HEBREW_MONTHS = [
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
] as const;

interface ViewedScheduleMonth {
  year: number;
  month: number;
}

function getPeriodLabel(
  period:
    MorningDriverAvailabilityPeriodListItem,
): string {
  return `${
    HEBREW_MONTHS[
      period.month - 1
    ] ??
    period.month
  } ${period.year}`;
}

function getCurrentMonth():
  ViewedScheduleMonth {
  const now =
    new Date();

  return {
    year:
      now.getFullYear(),

    month:
      now.getMonth() + 1,
  };
}

function shiftMonth(
  currentMonth:
    ViewedScheduleMonth,

  monthOffset:
    number,
): ViewedScheduleMonth {
  const shiftedDate =
    new Date(
      currentMonth.year,
      currentMonth.month -
        1 +
        monthOffset,
      1,
    );

  return {
    year:
      shiftedDate.getFullYear(),

    month:
      shiftedDate.getMonth() +
      1,
  };
}

function MorningDriverSchedulePage() {
  const {
    user:
      authenticatedUser,

    profile,

    hasPermission,
  } =
    useAuth();

  const {
    state:
      availabilityState,

    loadPeriods,
  } =
    useMorningDriverAvailabilityPeriods();

  const {
    state,
    loadSchedule,
    createDraft,
    updateAssignment,
    transferMyAssignment,
    publishSchedule,
  } =
    useMorningDriverSchedule();

  const [
    selectedAvailabilityPeriodId,
    setSelectedAvailabilityPeriodId,
  ] =
    useState('');

  const [
    viewedScheduleMonth,
    setViewedScheduleMonth,
  ] =
    useState<ViewedScheduleMonth>(
      getCurrentMonth,
    );


  const [
    selectedTransferAssignment,
    setSelectedTransferAssignment,
  ] =
    useState<
      MorningDriverScheduleAssignment |
      null
    >(
      null,
    );

  const canEdit =
    hasPermission(
      'morning_driver_schedule.edit',
    );

  const canEditPublishedAssignments =
    hasPermission(
      'morning_driver_schedule.edit_any',
    );

  const currentMonth =
    getCurrentMonth();

  const currentPeriodValue =
    currentMonth.year * 12 +
    currentMonth.month - 1;

  const viewedPeriodValue =
    viewedScheduleMonth.year * 12 +
    viewedScheduleMonth.month - 1;

  const canEditViewedPublishedAssignments =
    canEditPublishedAssignments &&
    (
      viewedPeriodValue ===
        currentPeriodValue ||
      viewedPeriodValue ===
        currentPeriodValue + 1
    ) &&
    state.data?.period.status ===
      'published';

  const canTransferMyAssignments =
    profile?.role ===
      'morning_driver' &&
    hasPermission(
      'morning_driver_schedule.view',
    );

  useEffect(
    () => {
      const initialMonth =
        getCurrentMonth();

      void loadPeriods();

      void loadSchedule(
        initialMonth.year,
        initialMonth.month,
      );
    },
    [
      loadPeriods,
      loadSchedule,
    ],
  );

  const closedAvailabilityPeriods =
    useMemo(
      () =>
        availabilityState.periods
          .filter(
            (
              period,
            ) =>
              period.status ===
              'closed',
          )
          .sort(
            (
              firstPeriod,
              secondPeriod,
            ) =>
              secondPeriod.year -
                firstPeriod.year ||
              secondPeriod.month -
                firstPeriod.month,
          ),
      [
        availabilityState.periods,
      ],
    );

  const loadViewedMonth =
    async (
      targetMonth:
        ViewedScheduleMonth,
    ): Promise<void> => {
      setViewedScheduleMonth(
        targetMonth,
      );

      await loadSchedule(
        targetMonth.year,
        targetMonth.month,
      );
    };

  const handlePreviousMonth =
    (): void => {
      void loadViewedMonth(
        shiftMonth(
          viewedScheduleMonth,
          -1,
        ),
      );
    };

  const handleNextMonth =
    (): void => {
      void loadViewedMonth(
        shiftMonth(
          viewedScheduleMonth,
          1,
        ),
      );
    };

  const handleCurrentMonth =
    (): void => {
      void loadViewedMonth(
        getCurrentMonth(),
      );
    };

  const handleCreateDraft =
    async (): Promise<void> => {
      if (
        !selectedAvailabilityPeriodId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          'ליצור טיוטת שיבוץ אוטומטית מחודש האילוצים שנבחר?\n\nשיבוצים לא נעולים בטיוטה קיימת יחושבו מחדש.',
        );

      if (!confirmed) {
        return;
      }

      const result =
        await createDraft(
          selectedAvailabilityPeriodId,
        );

      setViewedScheduleMonth({
        year:
          result.year,

        month:
          result.month,
      });
    };

  return (
    <section className="morning-driver-schedule-page">
      <header className="morning-driver-schedule-page-header">
        <div>
          <span className="morning-driver-schedule-eyebrow">
            <CalendarDays
              size={18}
              aria-hidden="true"
            />

            מערכת כונני בוקר
          </span>

          <h1>
            לוח כוננויות בוקר
          </h1>

          <p>
            צפייה לפי חודש, יצירת טיוטה אוטומטית, עריכה ידנית ופרסום לוח.
          </p>
        </div>

        <button
          type="button"
          className="morning-driver-schedule-secondary-button"
          disabled={
            state.isLoading
          }
          onClick={() => {
            void loadSchedule(
              viewedScheduleMonth.year,
              viewedScheduleMonth.month,
            );
          }}
        >
          <RefreshCw
            size={18}
            className={
              state.isLoading
                ? 'morning-driver-schedule-spin'
                : ''
            }
            aria-hidden="true"
          />

          רענון
        </button>
      </header>



      {canEdit ? (
        <section className="morning-driver-schedule-create-card">
          <div>
            <strong>
              יצירת טיוטת שיבוץ
            </strong>

            <span>
              ניתן ליצור שיבוץ רק מחודש אילוצים שנסגר.
            </span>
          </div>

          <div className="morning-driver-schedule-create-controls">
            <select
              value={
                selectedAvailabilityPeriodId
              }
              disabled={
                availabilityState.isLoading ||
                state.isCreating
              }
              onChange={(
                event,
              ) => {
                setSelectedAvailabilityPeriodId(
                  event.target.value,
                );
              }}
            >
              <option value="">
                בחירת חודש אילוצים סגור
              </option>

              {closedAvailabilityPeriods.map(
                (
                  period,
                ) => (
                  <option
                    key={
                      period.id
                    }
                    value={
                      period.id
                    }
                  >
                    {
                      getPeriodLabel(
                        period,
                      )
                    }
                  </option>
                ),
              )}
            </select>

            <button
              type="button"
              className="morning-driver-schedule-primary-button"
              disabled={
                !selectedAvailabilityPeriodId ||
                state.isCreating
              }
              onClick={() => {
                void handleCreateDraft();
              }}
            >
              {state.isCreating ? (
                <LoaderCircle
                  size={18}
                  className="morning-driver-schedule-spin"
                  aria-hidden="true"
                />
              ) : (
                <Sparkles
                  size={18}
                  aria-hidden="true"
                />
              )}

              {state.isCreating
                ? 'יוצר טיוטה...'
                : 'יצירת שיבוץ אוטומטי'}
            </button>
          </div>
        </section>
      ) : null}

      {state.error ? (
        <div
          className="morning-driver-schedule-error"
          role="alert"
        >
          {state.error}
        </div>
      ) : null}

      {state.lastCreatedResult ? (
        <div
          className="morning-driver-schedule-success"
          role="status"
        >
          טיוטת השיבוץ נוצרה: {
            state.lastCreatedResult
              .assignedAssignments
          } מתוך {
            state.lastCreatedResult
              .createdAssignments
          } הקצאות שובצו אוטומטית.
        </div>
      ) : null}

      <MorningDriverScheduleBoard
        data={
          state.data
        }
        isLoading={
          state.isLoading
        }
        updatingAssignmentId={
          state.updatingAssignmentId
        }
        isPublishing={
          state.isPublishing
        }
        viewedYear={
          viewedScheduleMonth.year
        }
        viewedMonth={
          viewedScheduleMonth.month
        }
        onPreviousMonth={
          handlePreviousMonth
        }
        onNextMonth={
          handleNextMonth
        }
        onCurrentMonth={
          handleCurrentMonth
        }
        canEdit={
          canEdit
        }
        canEditPublishedAssignments={
          canEditViewedPublishedAssignments
        }
        onRefresh={() => {
          void loadSchedule(
            viewedScheduleMonth.year,
            viewedScheduleMonth.month,
          );
        }}
        onUpdateAssignment={(
          request,
        ) => {
          void updateAssignment(
            request,
          );
        }}
        currentUserId={
          authenticatedUser?.id ??
          null
        }
        canTransferMyAssignments={
          canTransferMyAssignments
        }
        onSelectTransferAssignment={(
          assignment,
        ) => {
          setSelectedTransferAssignment(
            assignment,
          );
        }}
        onPublish={() => {
          const recommendationWarnings =
            state.data
              ?.statistics
              .recommendationUnfilled ??
            0;

          const confirmed =
            window.confirm(
              recommendationWarnings > 0
                ? `עדיין חסרים ${recommendationWarnings} כוננים להשלמת ההמלצה במשמרות הבוקר.\n\nהמינימום הושלם ולכן ניתן לפרסם. להמשיך?`
                : 'לפרסם את לוח כונני הבוקר?',
            );

          if (
            confirmed
          ) {
            void publishSchedule();
          }
        }}
      />

      {selectedTransferAssignment &&
      authenticatedUser?.id &&
      state.data ? (
        <MorningDriverAssignmentTransferDialog
          assignment={
            selectedTransferAssignment
          }
          drivers={
            state.data.drivers
          }
          currentUserId={
            authenticatedUser.id
          }
          isSaving={
            state.transferringAssignmentId ===
            selectedTransferAssignment.id
          }
          onClose={() => {
            if (
              state.transferringAssignmentId ===
              null
            ) {
              setSelectedTransferAssignment(
                null,
              );
            }
          }}
          onTransfer={async (
            newDriverId,
          ) => {
            try {
              await transferMyAssignment({
                assignmentId:
                  selectedTransferAssignment.id,

                newDriverId,
              });

              setSelectedTransferAssignment(
                null,
              );
            } catch {
              /*
               * הודעת השגיאה מוצגת מתוך ה-Hook.
               */
            }
          }}
        />
      ) : null}
    </section>
  );
}

export default MorningDriverSchedulePage;