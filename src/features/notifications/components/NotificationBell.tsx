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

function NotificationBell() {
  const {
    unreadCount,
    state,
  } =
    useNotificationContext();

  const [
    isOpen,
    setIsOpen,
  ] =
    useState(
      false,
    );

  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  useEffect(
    () => {
      if (
        !isOpen
      ) {
        return;
      }

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