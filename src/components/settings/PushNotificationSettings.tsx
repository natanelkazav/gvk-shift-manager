import {
  Bell,
  BellOff,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Smartphone,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  useNotificationPreferences,
} from '../../hooks/useNotificationPreferences';

import {
  pushNotificationService,
  type PushPermissionState,
} from '../../services/pushNotificationService';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from '../ui';


type ReminderUnit =
  | 'minutes'
  | 'hours';

const reminderMinuteOptions =
  Array.from(
    {
      length:
        60,
    },
    (
      _,
      index,
    ) =>
      index,
  );

const reminderHourOptions =
  Array.from(
    {
      length:
        25,
    },
    (
      _,
      index,
    ) =>
      index,
  );

function getReminderPickerValue(
  totalMinutes:
    number,
): {
  value: number;
  unit: ReminderUnit;
} {
  if (
    totalMinutes >=
      60 &&
    totalMinutes %
      60 ===
      0
  ) {
    return {
      value:
        totalMinutes /
        60,
      unit:
        'hours',
    };
  }

  return {
    value:
      Math.min(
        59,
        Math.max(
          0,
          totalMinutes,
        ),
      ),
    unit:
      'minutes',
  };
}

interface ReminderWheelPickerProps {
  minutes: number;

  disabled: boolean;

  onChange: (
    minutes:
      number,
  ) => void;
}

function ReminderWheelPicker({
  minutes,
  disabled,
  onChange,
}: ReminderWheelPickerProps) {
  const pickerValue =
    getReminderPickerValue(
      minutes,
    );

  const options =
    pickerValue.unit ===
      'hours'
      ? reminderHourOptions
      : reminderMinuteOptions;

  return (
    <div className="reminder-wheel-field">
      <span className="reminder-wheel-label">
        זמן לפני המשמרת
      </span>

      <div
        className="reminder-wheel-picker"
        aria-label="זמן התזכורת לפני המשמרת"
      >
        <select
          className="reminder-wheel-select reminder-wheel-number"
          value={
            pickerValue.value
          }
          disabled={
            disabled
          }
          aria-label="מספר"
          onChange={(
            event,
          ) => {
            const value =
              Number(
                event.target.value,
              );

            onChange(
              pickerValue.unit ===
                'hours'
                ? value *
                  60
                : value,
            );
          }}
        >
          {
            options.map(
              (
                value,
              ) => (
                <option
                  key={
                    value
                  }
                  value={
                    value
                  }
                >
                  {
                    value
                  }
                </option>
              ),
            )
          }
        </select>

        <select
          className="reminder-wheel-select reminder-wheel-unit"
          value={
            pickerValue.unit
          }
          disabled={
            disabled
          }
          aria-label="יחידת זמן"
          onChange={(
            event,
          ) => {
            const unit =
              event.target
                .value as
                ReminderUnit;

            if (
              unit ===
                'hours'
            ) {
              const hours =
                minutes ===
                  0
                  ? 0
                  : Math.min(
                      24,
                      Math.max(
                        1,
                        Math.round(
                          minutes /
                          60,
                        ),
                      ),
                    );

              onChange(
                hours *
                  60,
              );

              return;
            }

            onChange(
              minutes >=
                60
                ? Math.min(
                    59,
                    Math.max(
                      1,
                      Math.round(
                        minutes /
                        60,
                      ),
                    ),
                  )
                : minutes,
            );
          }}
        >
          <option value="minutes">
            דקות
          </option>

          <option value="hours">
            שעות
          </option>
        </select>
      </div>

      <span className="reminder-wheel-helper">
        גלול במספר ובחר דקות או שעות. ניתן לבחור עד 24 שעות לפני המשמרת.
      </span>
    </div>
  );
}

interface PushDeviceState {
  isSupported: boolean;

  permission:
    PushPermissionState;

  isSubscribed: boolean;

  isLoading: boolean;

  isChanging: boolean;

  error:
    string | null;
}

const initialDeviceState:
  PushDeviceState = {
    isSupported:
      false,

    permission:
      'unsupported',

    isSubscribed:
      false,

    isLoading:
      true,

    isChanging:
      false,

    error:
      null,
  };

function getPermissionLabel(
  permission:
    PushPermissionState,
): string {
  switch (
    permission
  ) {
    case 'granted':
      return 'הרשאה אושרה';

    case 'denied':
      return 'הרשאה נחסמה';

    case 'default':
      return 'טרם התבקשה הרשאה';

    case 'unsupported':
    default:
      return 'המכשיר אינו תומך';
  }
}

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בניהול התראות ה־Push.';
}

function PushNotificationSettings() {
  const {
    state:
      preferencesState,

    loadPreferences,

    updatePreferences,

    clearError,
  } =
    useNotificationPreferences();

  const [
    deviceState,
    setDeviceState,
  ] =
    useState<PushDeviceState>(
      initialDeviceState,
    );

  const [
    pushEnabled,
    setPushEnabled,
  ] =
    useState(
      true,
    );

  const [
    shiftRemindersEnabled,
    setShiftRemindersEnabled,
  ] =
    useState(
      true,
    );

  const [
    reminderMinutes,
    setReminderMinutes,
  ] =
    useState(
      10,
    );

  const [
    hasLoadedForm,
    setHasLoadedForm,
  ] =
    useState(
      false,
    );

  const loadDeviceStatus =
    useCallback(
      async (): Promise<void> => {
        setDeviceState(
          (
            currentState,
          ) => ({
            ...currentState,

            isLoading:
              true,

            error:
              null,
          }),
        );

        try {
          const status =
            await pushNotificationService
              .getStatus();

          setDeviceState({
            isSupported:
              status.isSupported,

            permission:
              status.permission,

            isSubscribed:
              status.isSubscribed,

            isLoading:
              false,

            isChanging:
              false,

            error:
              null,
          });
        } catch (
          error
        ) {
          setDeviceState(
            (
              currentState,
            ) => ({
              ...currentState,

              isLoading:
                false,

              error:
                getErrorMessage(
                  error,
                ),
            }),
          );
        }
      },
      [],
    );

  useEffect(
    () => {
      const loadInitialData =
        async (): Promise<void> => {
          try {
            const preferences =
              await loadPreferences();

            setPushEnabled(
              preferences.pushEnabled,
            );

            setShiftRemindersEnabled(
              preferences
                .shiftRemindersEnabled,
            );

            setReminderMinutes(
              preferences
                .shiftReminderMinutesBefore,
            );

            setHasLoadedForm(
              true,
            );
          } catch {
            /*
             * הודעת השגיאה מוצגת
             * מתוך ה־Hook.
             */
          }

          await loadDeviceStatus();
        };

      void loadInitialData();
    },
    [
      loadDeviceStatus,
      loadPreferences,
    ],
  );

  const handleEnablePush =
    async (): Promise<void> => {
      setDeviceState(
        (
          currentState,
        ) => ({
          ...currentState,

          isChanging:
            true,

          error:
            null,
        }),
      );

      try {
        await pushNotificationService
          .enablePush();

        setPushEnabled(
          true,
        );

        await updatePreferences({
          pushEnabled:
            true,

          shiftRemindersEnabled,

          shiftReminderMinutesBefore:
            reminderMinutes,
        });

        await loadDeviceStatus();
      } catch (
        error
      ) {
        setDeviceState(
          (
            currentState,
          ) => ({
            ...currentState,

            isChanging:
              false,

            error:
              getErrorMessage(
                error,
              ),
          }),
        );
      }
    };

  const handleDisablePush =
    async (): Promise<void> => {
      const confirmed =
        window.confirm(
          'האם לבטל את התראות ה־Push במכשיר הזה?',
        );

      if (
        !confirmed
      ) {
        return;
      }

      setDeviceState(
        (
          currentState,
        ) => ({
          ...currentState,

          isChanging:
            true,

          error:
            null,
        }),
      );

      try {
        await pushNotificationService
          .disablePush();

        await loadDeviceStatus();
      } catch (
        error
      ) {
        setDeviceState(
          (
            currentState,
          ) => ({
            ...currentState,

            isChanging:
              false,

            error:
              getErrorMessage(
                error,
              ),
          }),
        );
      }
    };

  const handleSavePreferences =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault();

      clearError();

      try {
        await updatePreferences({
          pushEnabled,

          shiftRemindersEnabled,

          shiftReminderMinutesBefore:
            reminderMinutes,
        });
      } catch {
        /*
         * הודעת השגיאה מוצגת
         * מתוך ה־Hook.
         */
      }
    };

  const isBusy =
    preferencesState.isLoading ||
    preferencesState.isSaving ||
    deviceState.isLoading ||
    deviceState.isChanging;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="settings-card-title-with-icon">
            <Bell
              size={
                20
              }
              aria-hidden="true"
            />

            התראות ותזכורות
          </span>
        </CardTitle>
      </CardHeader>

      <CardBody>
        <div className="push-settings-layout">
          <section className="push-device-section">
            <div className="push-settings-section-heading">
              <Smartphone
                size={
                  21
                }
                aria-hidden="true"
              />

              <div>
                <h3>
                  התראות Push במכשיר הזה
                </h3>

                <p>
                  הפעלת ההתראות מתבצעת בנפרד בכל טלפון או מחשב.
                </p>
              </div>
            </div>

            <dl className="push-device-status-list">
              <div>
                <dt>
                  תמיכה במכשיר
                </dt>

                <dd>
                  {
                    deviceState.isLoading
                      ? 'בודק...'
                      : deviceState.isSupported
                        ? 'נתמך'
                        : 'לא נתמך'
                  }
                </dd>
              </div>

              <div>
                <dt>
                  הרשאת דפדפן
                </dt>

                <dd>
                  {
                    deviceState.isLoading
                      ? 'בודק...'
                      : getPermissionLabel(
                          deviceState.permission,
                        )
                  }
                </dd>
              </div>

              <div>
                <dt>
                  רישום המכשיר
                </dt>

                <dd>
                  {
                    deviceState.isLoading
                      ? 'בודק...'
                      : deviceState.isSubscribed
                        ? 'המכשיר רשום'
                        : 'המכשיר אינו רשום'
                  }
                </dd>
              </div>
            </dl>

            {deviceState.error ? (
              <div
                className="settings-message settings-message-error"
                role="alert"
              >
                {
                  deviceState.error
                }
              </div>
            ) : null}

            <div className="push-device-actions">
              {!deviceState.isSubscribed ? (
                <Button
                  type="button"
                  disabled={
                    isBusy ||
                    !deviceState.isSupported ||
                    deviceState.permission ===
                      'denied'
                  }
                  onClick={() => {
                    void handleEnablePush();
                  }}
                >
                  <Bell
                    size={
                      17
                    }
                    aria-hidden="true"
                  />

                  {
                    deviceState.isChanging
                      ? 'מפעיל התראות...'
                      : 'הפעלת התראות במכשיר הזה'
                  }
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={
                    isBusy
                  }
                  onClick={() => {
                    void handleDisablePush();
                  }}
                >
                  <BellOff
                    size={
                      17
                    }
                    aria-hidden="true"
                  />

                  {
                    deviceState.isChanging
                      ? 'מבטל התראות...'
                      : 'ביטול התראות במכשיר הזה'
                  }
                </Button>
              )}

              <Button
                type="button"
                variant="secondary"
                disabled={
                  isBusy
                }
                onClick={() => {
                  void loadDeviceStatus();
                }}
              >
                <RefreshCw
                  size={
                    17
                  }
                  aria-hidden="true"
                />

                רענון מצב
              </Button>
            </div>

            {deviceState.permission ===
            'denied' ? (
              <div className="settings-message settings-message-warning">
                הרשאת ההתראות נחסמה. יש לפתוח את הגדרות האתר בדפדפן ולאפשר התראות ידנית.
              </div>
            ) : null}
          </section>

          <form
            className="push-preferences-form"
            onSubmit={
              handleSavePreferences
            }
          >
            <div className="push-settings-section-heading">
              <Clock3
                size={
                  21
                }
                aria-hidden="true"
              />

              <div>
                <h3>
                  תזכורת לפני משמרת
                </h3>

                <p>
                  הגדר מתי תישלח אליך תזכורת לפני תחילת המשמרת.
                </p>
              </div>
            </div>

            <label className="settings-checkbox-row">
              <input
                type="checkbox"
                checked={
                  pushEnabled
                }
                disabled={
                  !hasLoadedForm ||
                  preferencesState.isSaving
                }
                onChange={(
                  event,
                ) => {
                  setPushEnabled(
                    event.target.checked,
                  );
                }}
              />

              <span>
                לאפשר שליחת התראות Push לחשבון שלי
              </span>
            </label>

            <label className="settings-checkbox-row">
              <input
                type="checkbox"
                checked={
                  shiftRemindersEnabled
                }
                disabled={
                  !hasLoadedForm ||
                  preferencesState.isSaving ||
                  !pushEnabled
                }
                onChange={(
                  event,
                ) => {
                  setShiftRemindersEnabled(
                    event.target.checked,
                  );
                }}
              />

              <span>
                לשלוח לי תזכורת לפני תחילת משמרת
              </span>
            </label>

            <ReminderWheelPicker
              minutes={
                reminderMinutes
              }
              disabled={
                !hasLoadedForm ||
                preferencesState.isSaving ||
                !pushEnabled ||
                !shiftRemindersEnabled
              }
              onChange={
                setReminderMinutes
              }
            />

            {preferencesState.error ? (
              <div
                className="settings-message settings-message-error"
                role="alert"
              >
                {
                  preferencesState.error
                }
              </div>
            ) : null}

            {preferencesState.isSaved ? (
              <div
                className="settings-message settings-message-success"
                role="status"
              >
                <CheckCircle2
                  size={
                    18
                  }
                  aria-hidden="true"
                />

                הגדרות ההתראות נשמרו בהצלחה.
              </div>
            ) : null}

            <div className="form-actions">
              <Button
                type="submit"
                disabled={
                  !hasLoadedForm ||
                  preferencesState.isSaving
                }
              >
                {
                  preferencesState.isSaving
                    ? 'שומר הגדרות...'
                    : 'שמירת הגדרות'
                }
              </Button>
            </div>
          </form>
        </div>
      </CardBody>
    </Card>
  );
}

export default PushNotificationSettings;