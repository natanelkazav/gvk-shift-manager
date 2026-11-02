/**
 * קובץ: src/features/notifications/components/NotificationBell.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור התראות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: NotificationBell.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  Bell,
} from 'lucide-react';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  useNotificationContext,
} from '../context/useNotificationContext';

import NotificationPopover
  from './NotificationPopover';

/**
 * פעולה NotificationBell: התראות.
 */
function NotificationBell() {
  const {
    unreadCount,
    state,
  } =
    useNotificationContext();

  // מצב מקומי: isOpen — האם המצב פתוח; setIsOpen מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    isOpen,
    setIsOpen,
  ] =
    useState(
      false,
    );

  // הפניה יציבה containerRef בין רינדורים; שינוי current אינו מפעיל רינדור בפני עצמו.
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ isOpen, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isOpen.
      if (
        !isOpen
      ) {
        return;
      }

      /**
       * פעולה handleDocumentClick: טיפול באירוע עבור הנתון handleDocumentClick בהקשר הפעולה.
       * @param event — אירוע.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleDocumentClick =
        (
          event:
            MouseEvent,
        ): void => {
          if (
            !containerRef
              .current
              ?.contains(
                event.target as
                  Node,
              )
          ) {
            setIsOpen(
              false,
            );
          }
        };

      /**
       * פעולה handleEscape: טיפול באירוע עבור הנתון handleEscape בהקשר הפעולה.
       * @param event — אירוע.
       * @returns void — הפלט בהתאם לחתימה.
       */
      const handleEscape =
        (
          event:
            KeyboardEvent,
        ): void => {
          if (
            event.key ===
              'Escape'
          ) {
            setIsOpen(
              false,
            );
          }
        };

      document.addEventListener(
        'mousedown',
        handleDocumentClick,
      );

      document.addEventListener(
        'keydown',
        handleEscape,
      );

      return () => {
        document.removeEventListener(
          'mousedown',
          handleDocumentClick,
        );

        document.removeEventListener(
          'keydown',
          handleEscape,
        );
      };
    },
    [
      isOpen,
    ],
  );

  // accessibleLabel — תווית.
  const accessibleLabel =
    unreadCount > 0
      ? `פתיחת ההתראות. ${unreadCount} התראות שלא נקראו`
      : 'פתיחת ההתראות';

  return (
    <div
      ref={
        containerRef
      }
      className="notification-bell-container"
    >
      <button
        type="button"
        className="notification-bell-button"
        aria-label={
          accessibleLabel
        }
        aria-expanded={
          isOpen
        }
        aria-haspopup="dialog"
        title={
          accessibleLabel
        }
        disabled={
          state.isLoading
        }
        onClick={() => {
          setIsOpen(
            (
              currentValue,
            ) =>
              !currentValue,
          );
        }}
      >
        <Bell
          size={
            22
          }
          strokeWidth={
            2
          }
          aria-hidden="true"
        />

        {unreadCount >
        0 ? (
          <span
            className="notification-bell-badge"
            aria-hidden="true"
          >
            {
              unreadCount >
              99
                ? '99+'
                : unreadCount
            }
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <NotificationPopover />
      ) : null}
    </div>
  );
}

export default NotificationBell;