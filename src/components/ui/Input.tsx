import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  startIcon?: ReactNode;
}

function Input({
  id,
  label,
  error,
  helperText,
  startIcon,
  className = '',
  ...inputProps
}: InputProps) {
  const inputId =
    id ?? `input-${label.trim().toLowerCase().replace(/\s+/g, '-')}`;

  const descriptionId = error
    ? `${inputId}-error`
    : helperText
      ? `${inputId}-helper`
      : undefined;

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