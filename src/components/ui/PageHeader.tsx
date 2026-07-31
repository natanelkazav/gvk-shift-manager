import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

function PageHeader({
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header-title">{title}</h1>

        {description ? (
          <p className="page-header-description">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="page-actions">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export default PageHeader;
