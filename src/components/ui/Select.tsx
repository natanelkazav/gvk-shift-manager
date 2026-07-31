import type { SelectHTMLAttributes } from 'react';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
  placeholder?: string;
}

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
  const selectId =
    id ?? `select-${label.trim().toLowerCase().replace(/\s+/g, '-')}`;

  const descriptionId = error
    ? `${selectId}-error`
    : helperText
      ? `${selectId}-helper`
      : undefined;

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