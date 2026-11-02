/**
 * קובץ: src/components/settings/PushNotificationSettings.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור התראות Push / התראות / הגדרות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ReminderUnit, getReminderPickerValue, ReminderWheelPickerProps, ReminderWheelPicker, PushDeviceState, getPermissionLabel, getErrorMessage, PushNotificationSettingsProps, PushNotificationSettings.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  Bell,
  BellOff,
  CalendarClock,
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

/**
 * טיפוס ReminderUnit: תזכורות.
 */
type ReminderUnit =
  | 'minutes'
  | 'hours';

// reminderMinuteOptions — תזכורות / אפשרויות בחירה.
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

// reminderHourOptions — תזכורות / אפשרויות בחירה.
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

/**
 * פעולה getReminderPickerValue: שליפה או חישוב של תזכורות / ערך.
 * @param totalMinutes — סך הכול / דקות.
 * @returns { value: number; unit: ReminderUnit; } — הפלט בהתאם לחתימה.
 */
function getReminderPickerValue(
  totalMinutes: number,
): {
  // value — ערך.
  value: number;
  unit: ReminderUnit;
} {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר totalMinutes >= 60 && totalMinutes % 60 === 0.
  if (
    totalMinutes >= 60 &&
    totalMinutes % 60 === 0
  ) {
    return {
      value:
        totalMinutes / 60,
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

/**
 * חוזה הנתונים ReminderWheelPickerProps: תזכורות / מאפייני הרכיב.
 */
interface ReminderWheelPickerProps {
  // minutes — דקות.
  minutes: number;
  // disabled — האם האפשרות מושבתת.
  disabled: boolean;
  // onChange — פונקציית דיווח על שינוי.
  onChange: (
    minutes: number,
  ) => void;
}

/**
 * פעולה ReminderWheelPicker: תזכורות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function ReminderWheelPicker({
  minutes,
  disabled,
  onChange,
}: ReminderWheelPickerProps) {
  // pickerValue — ערך.
  const pickerValue =
    getReminderPickerValue(
      minutes,
    );

  // options — אפשרויות בחירה.
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
            // value — ערך.
            const value =
              Number(
                event.target.value,
              );

            onChange(
              pickerValue.unit ===
                'hours'
                ? value * 60
                : value,
            );
          }}
        >
          {options.map(
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
                {value}
              </option>
            ),
          )}
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

            // טיפול במקרה מיוחד ויציאה מוקדמת כאשר unit === 'hours'.
            if (
              unit ===
                'hours'
            ) {
              // hours — שעות.
              const hours =
                minutes === 0
                  ? 0
                  : Math.min(
                      24,
                      Math.max(
                        1,
                        Math.round(
                          minutes / 60,
                        ),
                      ),
                    );

              onChange(
                hours * 60,
              );

              return;
            }

            onChange(
              minutes >= 60
                ? Math.min(
                    59,
                    Math.max(
                      1,
                      Math.round(
                        minutes / 60,
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
        ניתן לבחור עד 24 שעות לפני תחילת המשמרת.
      </span>
    </div>
  );
}

/**
 * חוזה הנתונים PushDeviceState: התראות Push / מצב.
 */
interface PushDeviceState {
  isSupported: boolean;
  // permission — הרשאות.
  permission: PushPermissionState;
  isSubscribed: boolean;
  // isLoading — האם טעינה מתבצעת.
  isLoading: boolean;
  isChanging: boolean;
  // error — שגיאה.
  error: string | null;
}

// initialDeviceState — מצב.
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

/**
 * פעולה getPermissionLabel: שליפה או חישוב של הרשאות / תווית.
 * @param permission — הרשאות.
 * @returns string — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בניהול התראות ה־Push.';
}

/**
 * חוזה הנתונים PushNotificationSettingsProps: התראות Push / התראות / הגדרות / מאפייני הרכיב.
 */
interface PushNotificationSettingsProps {
  // showShiftReminderPreferences — משמרת / תזכורות.
  showShiftReminderPreferences: boolean;
  // showDriverDutyReminderPreferences — כוננים / תזכורות.
  showDriverDutyReminderPreferences: boolean;
}

/**
 * פעולה PushNotificationSettings: התראות Push / התראות / הגדרות.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function PushNotificationSettings({
  showShiftReminderPreferences,
  showDriverDutyReminderPreferences,
}: PushNotificationSettingsProps) {
  const {
    state:
      preferencesState,
    loadPreferences,
    updatePreferences,
    clearError,
  } =
    useNotificationPreferences();

  // מצב מקומי: deviceState — מצב; setDeviceState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    deviceState,
    setDeviceState,
  ] =
    useState<PushDeviceState>(
      initialDeviceState,
    );

  // מצב מקומי: pushEnabled — התראות Push / האם האפשרות מופעלת; setPushEnabled מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    pushEnabled,
    setPushEnabled,
  ] =
    useState(
      true,
    );

  // מצב מקומי: shiftRemindersEnabled — משמרת / תזכורות / האם האפשרות מופעלת; setShiftRemindersEnabled מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    shiftRemindersEnabled,
    setShiftRemindersEnabled,
  ] =
    useState(
      true,
    );

  // מצב מקומי: reminderMinutes — תזכורות / דקות; setReminderMinutes מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    reminderMinutes,
    setReminderMinutes,
  ] =
    useState(
      10,
    );

  // מצב מקומי: driverDutyRemindersEnabled — כוננים / תזכורות / האם האפשרות מופעלת; setDriverDutyRemindersEnabled מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    driverDutyRemindersEnabled,
    setDriverDutyRemindersEnabled,
  ] =
    useState(
      false,
    );

  // מצב מקומי: driverDutyReminderTime — כוננים / תזכורות / זמן; setDriverDutyReminderTime מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    driverDutyReminderTime,
    setDriverDutyReminderTime,
  ] =
    useState(
      '09:00',
    );

  // מצב מקומי: hasLoadedForm — הנתון hasLoadedForm בהקשר הפעולה; setHasLoadedForm מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    hasLoadedForm,
    setHasLoadedForm,
  ] =
    useState(
      false,
    );

  // loadDeviceStatus — סטטוס.
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

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // status — סטטוס.
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

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ loadDeviceStatus, loadPreferences, ].
  useEffect(
    () => {
      /**
       * פעולה אסינכרונית loadInitialData: טעינת נתונים.
       * @returns Promise<void> — הפלט בהתאם לחתימה.
       */
      const loadInitialData =
        async (): Promise<void> => {
          // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
          try {
            const preferences =
              await loadPreferences();

            setPushEnabled(
              preferences.pushEnabled,
            );
            setShiftRemindersEnabled(
              preferences.shiftRemindersEnabled,
            );
            setReminderMinutes(
              preferences.shiftReminderMinutesBefore,
            );
            setDriverDutyRemindersEnabled(
              preferences.driverDutyRemindersEnabled,
            );
            setDriverDutyReminderTime(
              preferences.driverDutyReminderTime,
            );
            setHasLoadedForm(
              true,
            );
          } catch {
            // השגיאה מוצגת דרך ה-Hook.
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

  const persistPreferences =
    useCallback(
      async (
        nextPushEnabled: boolean,
      ): Promise<void> => {
        await updatePreferences({
          pushEnabled:
            nextPushEnabled,
          shiftRemindersEnabled,
          shiftReminderMinutesBefore:
            reminderMinutes,
          driverDutyRemindersEnabled,
          driverDutyReminderTime,
        });
      },
      [
        driverDutyReminderTime,
        driverDutyRemindersEnabled,
        reminderMinutes,
        shiftRemindersEnabled,
        updatePreferences,
      ],
    );

  /**
   * פעולה אסינכרונית handleEnablePush: טיפול באירוע עבור התראות Push.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
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

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await pushNotificationService
          .enablePush();

        setPushEnabled(
          true,
        );
        await persistPreferences(
          true,
        );
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

  /**
   * פעולה אסינכרונית handleDisablePush: טיפול באירוע עבור התראות Push.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleDisablePush =
    async (): Promise<void> => {
      const confirmed =
        window.confirm(
          'האם לבטל את התראות ה־Push במכשיר הזה?',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !confirmed.
      if (!confirmed) {
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

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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

  /**
   * פעולה אסינכרונית handleSavePreferences: טיפול באירוע עבור הנתון handleSavePreferences בהקשר הפעולה.
   * @param event — אירוע.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleSavePreferences =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ): Promise<void> => {
      event.preventDefault();
      clearError();

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await persistPreferences(
          pushEnabled,
        );
      } catch {
        // השגיאה מוצגת דרך ה-Hook.
      }
    };

  // isBusy — הנתון isBusy בהקשר הפעולה.
  const isBusy =
    preferencesState.isLoading ||
    preferencesState.isSaving ||
    deviceState.isLoading ||
    deviceState.isChanging;

  // hasReminderPreferences — תזכורות.
  const hasReminderPreferences =
    showShiftReminderPreferences ||
    showDriverDutyReminderPreferences;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="settings-card-title-with-icon">
            <Bell
              size={20}
              aria-hidden="true"
            />
            התראות ותזכורות
          </span>
        </CardTitle>
      </CardHeader>

      <CardBody>
        <div
          className={
            hasReminderPreferences
              ? 'push-settings-layout'
              : 'push-settings-layout push-settings-layout-single'
          }
        >
          <section className="push-device-section">
            <div className="push-settings-section-heading">
              <Smartphone
                size={21}
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
                <dt>תמיכה במכשיר</dt>
                <dd>
                  {deviceState.isLoading
                    ? 'בודק...'
                    : deviceState.isSupported
                      ? 'נתמך'
                      : 'לא נתמך'}
                </dd>
              </div>

              <div>
                <dt>הרשאת דפדפן</dt>
                <dd>
                  {deviceState.isLoading
                    ? 'בודק...'
                    : getPermissionLabel(
                        deviceState.permission,
                      )}
                </dd>
              </div>

              <div>
                <dt>רישום המכשיר</dt>
                <dd>
                  {deviceState.isLoading
                    ? 'בודק...'
                    : deviceState.isSubscribed
                      ? 'המכשיר רשום'
                      : 'המכשיר אינו רשום'}
                </dd>
              </div>
            </dl>

            {deviceState.error ? (
              <div
                className="settings-message settings-message-error"
                role="alert"
              >
                {deviceState.error}
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
                    size={17}
                    aria-hidden="true"
                  />
                  {deviceState.isChanging
                    ? 'מפעיל התראות...'
                    : 'הפעלת התראות במכשיר הזה'}
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
                    size={17}
                    aria-hidden="true"
                  />
                  {deviceState.isChanging
                    ? 'מבטל התראות...'
                    : 'ביטול התראות במכשיר הזה'}
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
                  size={17}
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

          {hasReminderPreferences ? (
            <form
              className="push-preferences-form"
              onSubmit={
                handleSavePreferences
              }
            >
              <div className="push-settings-section-heading">
                <Clock3
                  size={21}
                  aria-hidden="true"
                />
                <div>
                  <h3>התזכורות שלי</h3>
                  <p>
                    מוצגות רק תזכורות שמתאימות ללוחות שאליהם יש לך גישה.
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

              {showShiftReminderPreferences ? (
                <section className="settings-reminder-card">
                  <div className="settings-reminder-card-heading">
                    <Clock3
                      size={19}
                      aria-hidden="true"
                    />
                    <div>
                      <strong>
                        תזכורת לפני משמרת
                      </strong>
                      <span>
                        למוקדנים ולכונני בוקר — לפי המשמרות שאליהן שובצת.
                      </span>
                    </div>
                  </div>

                  <label className="settings-checkbox-row settings-checkbox-row-compact">
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
                </section>
              ) : null}

              {showDriverDutyReminderPreferences ? (
                <section className="settings-reminder-card settings-reminder-card-duty">
                  <div className="settings-reminder-card-heading">
                    <CalendarClock
                      size={19}
                      aria-hidden="true"
                    />
                    <div>
                      <strong>
                        תזכורת ביום הכוננות
                      </strong>
                      <span>
                        ביום שבו אתה משובץ ככונן תישלח אליך תזכורת בשעה שתבחר.
                      </span>
                    </div>
                  </div>

                  <label className="settings-checkbox-row settings-checkbox-row-compact">
                    <input
                      type="checkbox"
                      checked={
                        driverDutyRemindersEnabled
                      }
                      disabled={
                        !hasLoadedForm ||
                        preferencesState.isSaving ||
                        !pushEnabled
                      }
                      onChange={(
                        event,
                      ) => {
                        setDriverDutyRemindersEnabled(
                          event.target.checked,
                        );
                      }}
                    />
                    <span>
                      להזכיר לי ביום שבו אני בכוננות
                    </span>
                  </label>

                  <label className="settings-time-field">
                    <span>
                      שעת התזכורת
                    </span>
                    <input
                      type="time"
                      value={
                        driverDutyReminderTime
                      }
                      disabled={
                        !hasLoadedForm ||
                        preferencesState.isSaving ||
                        !pushEnabled ||
                        !driverDutyRemindersEnabled
                      }
                      onChange={(
                        event,
                      ) => {
                        setDriverDutyReminderTime(
                          event.target.value,
                        );
                      }}
                    />
                    <small>
                      לפי שעון ישראל. ברירת המחדל היא כבויה, ורק לאחר הפעלה תישלח תזכורת.
                    </small>
                  </label>

                  {driverDutyRemindersEnabled &&
                  pushEnabled ? (
                    <div className="settings-reminder-preview">
                      ביום כוננות תקבל תזכורת בשעה{' '}
                      <strong>
                        {driverDutyReminderTime}
                      </strong>
                      .
                    </div>
                  ) : null}
                </section>
              ) : null}

              {preferencesState.error ? (
                <div
                  className="settings-message settings-message-error"
                  role="alert"
                >
                  {preferencesState.error}
                </div>
              ) : null}

              {preferencesState.isSaved ? (
                <div
                  className="settings-message settings-message-success"
                  role="status"
                >
                  <CheckCircle2
                    size={18}
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
                  {preferencesState.isSaving
                    ? 'שומר הגדרות...'
                    : 'שמירת הגדרות'}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

export default PushNotificationSettings;
