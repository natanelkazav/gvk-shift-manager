import type { TextareaHTMLAttributes } from 'react';

interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helperText?: string;
}

function Textarea({
  id,
  label,
  error,
  helperText,
  className = '',
  ...textareaProps
}: TextareaProps) {
  const textareaId =
    id ?? `textarea-${label.trim().toLowerCase().replace(/\s+/g, '-')}`;

  const descriptionId = error
    ? `${textareaId}-error`
    : helperText
      ? `${textareaId}-helper`
      : undefined;

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