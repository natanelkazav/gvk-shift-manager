/**
 * קובץ: src/components/ui/Input.tsx
 * מטרה: מימוש רכיב תצוגה ואינטראקציה עבור קלט.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: InputProps, Input.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import type { InputHTMLAttributes, ReactNode } from 'react';

/**
 * חוזה הנתונים InputProps: קלט / מאפייני הרכיב.
 */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  // label — תווית.
  label: string;
  // error — שגיאה (אופציונלי).
  error?: string;
  helperText?: string;
  startIcon?: ReactNode;
}

/**
 * פעולה Input: קלט.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function Input({
  id,
  label,
  error,
  helperText,
  startIcon,
  className = '',
  ...inputProps
}: InputProps) {
  // inputId — קלט / מזהה.
  const inputId =
    id ?? `input-${label.trim().toLowerCase().replace(/\s+/g, '-')}`;

  // descriptionId — מזהה.
  const descriptionId = error
    ? `${inputId}-error`
    : helperText
      ? `${inputId}-helper`
      : undefined;

  // inputClassName — קלט / שם.
  const inputClassName = [
    'form-input',
    startIcon ? 'form-input-with-icon' : '',
    error ? 'form-input-error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="form-field">
      <label className="form-label" htmlFor={inputId}>
        {label}

        {inputProps.required ? (
          <span className="form-required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <div className="form-control-wrapper">
        {startIcon ? (
          <span className="form-control-icon" aria-hidden="true">
            {startIcon}
          </span>
        ) : null}

        <input
          id={inputId}
          className={inputClassName}
          aria-invalid={Boolean(error)}
          aria-describedby={descriptionId}
          {...inputProps}
        />
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="form-message form-message-error">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="form-message">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export default Input;