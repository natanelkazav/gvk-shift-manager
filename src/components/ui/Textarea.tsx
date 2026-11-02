/**
 * קובץ: src/components/ui/Textarea.tsx
 * מטרה: שדה טקסט רב־שורות עם מאפייני הממשק המשותפים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: TextareaProps, Textarea.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import type { TextareaHTMLAttributes } from 'react';

/**
 * חוזה הנתונים TextareaProps: מאפייני הרכיב.
 */
interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  // label — תווית.
  label: string;
  // error — שגיאה (אופציונלי).
  error?: string;
  helperText?: string;
}

/**
 * פעולה Textarea: הנתון Textarea בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function Textarea({
  id,
  label,
  error,
  helperText,
  className = '',
  ...textareaProps
}: TextareaProps) {
  // textareaId — מזהה.
  const textareaId =
    id ?? `textarea-${label.trim().toLowerCase().replace(/\s+/g, '-')}`;

  // descriptionId — מזהה.
  const descriptionId = error
    ? `${textareaId}-error`
    : helperText
      ? `${textareaId}-helper`
      : undefined;

  // textareaClassName — שם.
  const textareaClassName = [
    'form-textarea',
    error ? 'form-input-error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="form-field">
      <label className="form-label" htmlFor={textareaId}>
        {label}

        {textareaProps.required ? (
          <span className="form-required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <textarea
        id={textareaId}
        className={textareaClassName}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionId}
        {...textareaProps}
      />

      {error ? (
        <p
          id={`${textareaId}-error`}
          className="form-message form-message-error"
        >
          {error}
        </p>
      ) : helperText ? (
        <p id={`${textareaId}-helper`} className="form-message">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export default Textarea;