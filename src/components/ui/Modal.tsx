/**
 * קובץ: src/components/ui/Modal.tsx
 * מטרה: מעטפת חלון מודאלי להצגת תוכן ולטיפול בסגירה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ModalProps, lockBodyScroll, unlockBodyScroll, Modal.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import {
  X,
} from 'lucide-react';

import {
  useEffect,
  useId,
  type MouseEvent,
  type ReactNode,
} from 'react';

/**
 * חוזה הנתונים ModalProps: מאפייני הרכיב.
 */
interface ModalProps {
  // isOpen — האם המצב פתוח.
  isOpen: boolean;
  // title — כותרת.
  title: string;
  // children — התוכן המקונן של הרכיב.
  children: ReactNode;
  footer?: ReactNode;
  // onClose — פונקציית סגירת התצוגה.
  onClose: () => void;
  // className — שם (אופציונלי).
  className?: string;
}

/*
 * מספר המודאלים הפתוחים כרגע.
 *
 * נדרש משום שייתכן Modal בתוך Modal
 * (לדוגמה: יום בלוח → עריכת שיבוץ).
 */
// openModalCount — כמות.
let openModalCount =
  0;

// originalBodyOverflow — תוכן.
let originalBodyOverflow =
  '';

/**
 * פעולה lockBodyScroll: תוכן.
 * @returns void — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה unlockBodyScroll: תוכן.
 * @returns void — הפלט בהתאם לחתימה.
 */
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

/**
 * פעולה Modal: הנתון Modal בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function Modal({
  isOpen,
  title,
  children,
  footer,
  onClose,
  className,
}: ModalProps) {
  // titleId — כותרת / מזהה.
  const titleId =
    useId();

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ isOpen, onClose, ].
  useEffect(
    () => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isOpen.
      if (
        !isOpen
      ) {
        return undefined;
      }

      /**
       * פעולה handleKeyDown: טיפול באירוע עבור מפתח.
       * @param event — אירוע.
       * @returns void — הפלט בהתאם לחתימה.
       */
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

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isOpen.
  if (
    !isOpen
  ) {
    return null;
  }

  /**
   * פעולה handleBackdropClick: טיפול באירוע עבור הנתון handleBackdropClick בהקשר הפעולה.
   * @param event — אירוע.
   * @returns void — הפלט בהתאם לחתימה.
   */
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
        className={`modal${className ? ` ${className}` : ''}`}
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