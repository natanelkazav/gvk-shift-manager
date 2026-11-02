/**
 * קובץ: src/components/ui/Button.tsx
 * מטרה: כפתור משותף עם מצבים וסגנונות המוגדרים במאפייניו.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ButtonVariant, ButtonProps, Button.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import type {
  ButtonHTMLAttributes,
  ReactNode,
} from 'react';

/**
 * טיפוס ButtonVariant: הנתון ButtonVariant בהקשר הפעולה.
 */
type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger';

/**
 * חוזה הנתונים ButtonProps: מאפייני הרכיב.
 */
interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  // children — התוכן המקונן של הרכיב.
  children: ReactNode;
  variant?: ButtonVariant;
}

/**
 * פעולה Button: הנתון Button בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...buttonProps
}: ButtonProps) {
  // buttonClassName — שם.
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