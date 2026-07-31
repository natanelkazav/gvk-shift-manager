import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

function Card({
  children,
  className = '',
  ...articleProps
}: CardProps) {
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

function CardHeader({
  children,
  className = '',
  ...headerProps
}: CardHeaderProps) {
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

function CardBody({
  children,
  className = '',
  ...bodyProps
}: CardBodyProps) {
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

function CardTitle({
  children,
  className = '',
  ...titleProps
}: CardTitleProps) {
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