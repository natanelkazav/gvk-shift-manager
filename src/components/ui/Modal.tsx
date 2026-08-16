import {
  X,
} from 'lucide-react';

import {
  useEffect,
  useId,
  type MouseEvent,
  type ReactNode,
} from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

/*
 * מספר המודאלים הפתוחים כרגע.
 *
 * נדרש משום שייתכן Modal בתוך Modal
 * (לדוגמה: יום בלוח → עריכת שיבוץ).
 */
let openModalCount =
  0;

let originalBodyOverflow =
  '';

function lockBodyScroll(): void {
  if (
    openModalCount ===
      0
  ) {
    originalBodyOverflow =
      document.body.style
        .overflow;

    document.body.style
      .overflow =
        'hidden';
  }

  openModalCount +=
    1;
}

function unlockBodyScroll(): void {
  openModalCount =
    Math.max(
      0,
      openModalCount - 1,
    );

  if (
    openModalCount ===
      0
  ) {
    document.body.style
      .overflow =
        originalBodyOverflow;

    originalBodyOverflow =
      '';
  }
}

function Modal({
  isOpen,
  title,
  children,
  footer,
  onClose,
}: ModalProps) {
  const titleId =
    useId();

  useEffect(
    () => {
      if (
        !isOpen
      ) {
        return undefined;
      }

      const handleKeyDown =
        (
          event:
            KeyboardEvent,
        ): void => {
          if (
            event.key ===
              'Escape'
          ) {
            onClose();
          }
        };

      lockBodyScroll();

      document.addEventListener(
        'keydown',
        handleKeyDown,
      );

      return () => {
        document.removeEventListener(
          'keydown',
          handleKeyDown,
        );

        unlockBodyScroll();
      };
    },
    [
      isOpen,
      onClose,
    ],
  );

  if (
    !isOpen
  ) {
    return null;
  }

  const handleBackdropClick =
    (
      event:
        MouseEvent<HTMLDivElement>,
    ): void => {
      if (
        event.target ===
          event.currentTarget
      ) {
        onClose();
      }
    };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={
        handleBackdropClick
      }
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={
          titleId
        }
      >
        <header className="modal-header">
          <h2
            id={
              titleId
            }
            className="modal-title"
          >
            {
              title
            }
          </h2>

          <button
            type="button"
            className="modal-close-button"
            aria-label="סגירת החלון"
            onClick={
              onClose
            }
          >
            <X
              size={22}
              aria-hidden="true"
            />
          </button>
        </header>

        <div className="modal-body">
          {
            children
          }
        </div>

        {footer ? (
          <footer className="modal-footer">
            {
              footer
            }
          </footer>
        ) : null}
      </section>
    </div>
  );
}

export default Modal;