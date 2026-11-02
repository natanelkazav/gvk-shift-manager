/**
 * קובץ: src/components/ui/Select.tsx
 * מטרה: רכיב בחירה מתוך רשימת אפשרויות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SelectOption, SelectProps, Select.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import type { SelectHTMLAttributes } from 'react';

/**
 * חוזה הנתונים SelectOption: הנתון SelectOption בהקשר הפעולה.
 */
export interface SelectOption {
  // label — תווית.
  label: string;
  // value — ערך.
  value: string;
  // disabled — האם האפשרות מושבתת (אופציונלי).
  disabled?: boolean;
}

/**
 * חוזה הנתונים SelectProps: מאפייני הרכיב.
 */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  // label — תווית.
  label: string;
  // options — אפשרויות בחירה.
  options: SelectOption[];
  // error — שגיאה (אופציונלי).
  error?: string;
  helperText?: string;
  placeholder?: string;
}

/**
 * פעולה Select: בחירת הנתון Select בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function Select({
  id,
  label,
  options,
  error,
  helperText,
  placeholder,
  className = '',
  ...selectProps
}: SelectProps) {
  // selectId — מזהה.
  const selectId =
    id ?? `select-${label.trim().toLowerCase().replace(/\s+/g, '-')}`;

  // descriptionId — מזהה.
  const descriptionId = error
    ? `${selectId}-error`
    : helperText
      ? `${selectId}-helper`
      : undefined;

  // selectClassName — שם.
  const selectClassName = [
    'form-select',
    error ? 'form-input-error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="form-field">
      <label className="form-label" htmlFor={selectId}>
        {label}

        {selectProps.required ? (
          <span className="form-required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <select
        id={selectId}
        className={selectClassName}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionId}
        {...selectProps}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>

      {error ? (
        <p id={`${selectId}-error`} className="form-message form-message-error">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${selectId}-helper`} className="form-message">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export default Select;