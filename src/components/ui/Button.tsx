import type {
  ButtonHTMLAttributes,
  ReactNode,
} from 'react';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger';

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...buttonProps
}: ButtonProps) {
  const buttonClassName = [
    'button',
    `button-${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={buttonClassName}
      {...buttonProps}
    >
      {children}
    </button>
  );
}

export default Button;