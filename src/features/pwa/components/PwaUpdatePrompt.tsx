/**
 * קובץ: src/features/pwa/components/PwaUpdatePrompt.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור התקנה ועדכוני PWA.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: PwaUpdatePrompt.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
/// <reference types="vite-plugin-pwa/react" />

import {
  RefreshCw,
  X,
} from 'lucide-react';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useRegisterSW,
} from 'virtual:pwa-register/react';

import '../../../styles/pwaUpdate.css';

// updateCheckIntervalMs — מרווח זמן.
const updateCheckIntervalMs =
  5 * 60 * 1000;

/**
 * פעולה PwaUpdatePrompt: התקנה ועדכוני PWA.
 */
function PwaUpdatePrompt() {
  // הפניה יציבה registrationRef בין רינדורים; שינוי current אינו מפעיל רינדור בפני עצמו.
  const registrationRef =
    useRef<
      ServiceWorkerRegistration | null
    >(null);

  // מצב מקומי: isUpdating — הנתון isUpdating בהקשר הפעולה; setIsUpdating מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isUpdating,
    setIsUpdating,
  ] =
    useState(false);

  // מצב מקומי: updateError — שגיאה; setUpdateError מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    updateError,
    setUpdateError,
  ] =
    useState<
      string | null
    >(null);

  const {
    needRefresh: [
      needRefresh,
      setNeedRefresh,
    ],

    updateServiceWorker,
  } =
    useRegisterSW({
      immediate:
        true,

      /**
       * פעולה onRegisteredSW: הנתון onRegisteredSW בהקשר הפעולה.
       * @param _serviceWorkerUrl — שירות / כתובת יעד.
       * @param registration — הנתון registration בהקשר הפעולה.
       */
      onRegisteredSW(
        _serviceWorkerUrl,
        registration,
      ) {
        registrationRef.current =
          registration ??
          null;
      },

      /**
       * פעולה onRegisterError: שגיאה.
       * @param error — שגיאה.
       */
      onRegisterError(
        error,
      ) {
        console.error(
          'PWA service worker registration failed:',
          error,
        );
      },
    });

  const checkForUpdate =
    useCallback(
      async (): Promise<void> => {
        const registration =
          registrationRef.current;

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !registration || !navigator.onLine.
        if (
          !registration ||
          !navigator.onLine
        ) {
          return;
        }

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          await registration.update();
        } catch (
          error
        ) {
          console.error(
            'PWA update check failed:',
            error,
          );
        }
      },
      [],
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ checkForUpdate, ].
  useEffect(
    () => {
      // intervalId — מרווח זמן / מזהה.
      const intervalId =
        window.setInterval(
          () => {
            if (
              document.visibilityState ===
                'visible'
            ) {
              void checkForUpdate();
            }
          },
          updateCheckIntervalMs,
        );

      /**
       * פעולה handleVisibilityChange: טיפול באירוע עבור הנתון handleVisibilityChange בהקשר הפעולה.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleVisibilityChange =
        (): void => {
          if (
            document.visibilityState ===
              'visible'
          ) {
            void checkForUpdate();
          }
        };

      /**
       * פעולה handleWindowFocus: טיפול באירוע עבור הנתון handleWindowFocus בהקשר הפעולה.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleWindowFocus =
        (): void => {
          void checkForUpdate();
        };

      /**
       * פעולה handleOnline: טיפול באירוע עבור הנתון handleOnline בהקשר הפעולה.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleOnline =
        (): void => {
          void checkForUpdate();
        };

      document.addEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );

      window.addEventListener(
        'focus',
        handleWindowFocus,
      );

      window.addEventListener(
        'online',
        handleOnline,
      );

      // initialCheckId — מזהה.
      const initialCheckId =
        window.setTimeout(
          () => {
            void checkForUpdate();
          },
          2500,
        );

      return () => {
        window.clearInterval(
          intervalId,
        );

        window.clearTimeout(
          initialCheckId,
        );

        document.removeEventListener(
          'visibilitychange',
          handleVisibilityChange,
        );

        window.removeEventListener(
          'focus',
          handleWindowFocus,
        );

        window.removeEventListener(
          'online',
          handleOnline,
        );
      };
    },
    [
      checkForUpdate,
    ],
  );

  /**
   * פעולה אסינכרונית handleUpdateNow: טיפול באירוע עבור הנתון handleUpdateNow בהקשר הפעולה.
   * @returns Promise<void> — הפלט בהתאם לחתימה.
   */
  const handleUpdateNow =
    async (): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר isUpdating.
      if (
        isUpdating
      ) {
        return;
      }

      setIsUpdating(
        true,
      );

      setUpdateError(
        null,
      );

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await updateServiceWorker(
          true,
        );
      } catch (
        error
      ) {
        console.error(
          'PWA update activation failed:',
          error,
        );

        setUpdateError(
          'לא ניתן היה להפעיל את הגרסה החדשה. נסה שוב בעוד רגע.',
        );

        setIsUpdating(
          false,
        );
      }
    };

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !needRefresh.
  if (
    !needRefresh
  ) {
    return null;
  }

  return (
    <aside
      className="pwa-update-banner"
      role="status"
      aria-live="polite"
    >
      <div className="pwa-update-banner-main">
        <span
          className="pwa-update-banner-icon"
          aria-hidden="true"
        >
          <RefreshCw
            size={21}
          />
        </span>

        <div className="pwa-update-banner-content">
          <strong>
            גרסה חדשה של המערכת זמינה
          </strong>

          <span>
            עדכון קצר יטען את הפיצ'רים והתיקונים האחרונים.
          </span>

          {updateError ? (
            <small
              className="pwa-update-banner-error"
              role="alert"
            >
              {updateError}
            </small>
          ) : null}
        </div>
      </div>

      <div className="pwa-update-banner-actions">
        <button
          type="button"
          className="pwa-update-button pwa-update-button-primary"
          disabled={
            isUpdating
          }
          onClick={() => {
            void handleUpdateNow();
          }}
        >
          <RefreshCw
            size={17}
            className={
              isUpdating
                ? 'pwa-update-button-spinner'
                : undefined
            }
            aria-hidden="true"
          />

          {isUpdating
            ? 'מעדכן...'
            : 'עדכן עכשיו'}
        </button>

        <button
          type="button"
          className="pwa-update-button pwa-update-button-secondary"
          disabled={
            isUpdating
          }
          onClick={() => {
            setNeedRefresh(
              false,
            );
          }}
        >
          <X
            size={17}
            aria-hidden="true"
          />

          מאוחר יותר
        </button>
      </div>
    </aside>
  );
}

export default PwaUpdatePrompt;
