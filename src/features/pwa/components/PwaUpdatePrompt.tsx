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

const updateCheckIntervalMs =
  5 * 60 * 1000;

function PwaUpdatePrompt() {
  const registrationRef =
    useRef<
      ServiceWorkerRegistration | null
    >(null);

  const [
    isUpdating,
    setIsUpdating,
  ] =
    useState(false);

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

      onRegisteredSW(
        _serviceWorkerUrl,
        registration,
      ) {
        registrationRef.current =
          registration ??
          null;
      },

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

        if (
          !registration ||
          !navigator.onLine
        ) {
          return;
        }

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

  useEffect(
    () => {
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

      const handleVisibilityChange =
        (): void => {
          if (
            document.visibilityState ===
              'visible'
          ) {
            void checkForUpdate();
          }
        };

      const handleWindowFocus =
        (): void => {
          void checkForUpdate();
        };

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

  const handleUpdateNow =
    async (): Promise<void> => {
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
