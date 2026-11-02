/**
 * קובץ: src/components/ui/Card.tsx
 * מטרה: מעטפת כרטיס משותפת להצגת תוכן.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: CardProps, CardHeaderProps, CardBodyProps, CardTitleProps, Card, CardHeader, CardBody, CardTitle.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
import type { HTMLAttributes, ReactNode } from 'react';

/**
 * חוזה הנתונים CardProps: מאפייני הרכיב.
 */
interface CardProps extends HTMLAttributes<HTMLElement> {
  // children — התוכן המקונן של הרכיב.
  children: ReactNode;
}

/**
 * חוזה הנתונים CardHeaderProps: מאפייני הרכיב.
 */
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  // children — התוכן המקונן של הרכיב.
  children: ReactNode;
}

/**
 * חוזה הנתונים CardBodyProps: תוכן / מאפייני הרכיב.
 */
interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  // children — התוכן המקונן של הרכיב.
  children: ReactNode;
}

/**
 * חוזה הנתונים CardTitleProps: כותרת / מאפייני הרכיב.
 */
interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  // children — התוכן המקונן של הרכיב.
  children: ReactNode;
}

/**
 * פעולה Card: הנתון Card בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function Card({
  children,
  className = '',
  ...articleProps
}: CardProps) {
  // cardClassName — שם.
  const cardClassName = ['card', className].filter(Boolean).join(' ');

  return (
    <article
      className={cardClassName}
      {...articleProps}
    >
      {children}
    </article>
  );
}

/**
 * פעולה CardHeader: הנתון CardHeader בהקשר הפעולה.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function CardHeader({
  children,
  className = '',
  ...headerProps
}: CardHeaderProps) {
  // headerClassName — שם.
  const headerClassName = ['card-header', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={headerClassName}
      {...headerProps}
    >
      {children}
    </div>
  );
}

/**
 * פעולה CardBody: תוכן.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function CardBody({
  children,
  className = '',
  ...bodyProps
}: CardBodyProps) {
  // bodyClassName — תוכן / שם.
  const bodyClassName = ['card-body', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={bodyClassName}
      {...bodyProps}
    >
      {children}
    </div>
  );
}

/**
 * פעולה CardTitle: כותרת.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
function CardTitle({
  children,
  className = '',
  ...titleProps
}: CardTitleProps) {
  // titleClassName — כותרת / שם.
  const titleClassName = ['card-title', className]
    .filter(Boolean)
    .join(' ');

  return (
    <h2
      className={titleClassName}
      {...titleProps}
    >
      {children}
    </h2>
  );
}

export {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
};