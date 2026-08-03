import type {
  ReactNode,
} from 'react';

interface DashboardCardProps {
  title: string;

  icon?: ReactNode;

  badge?: ReactNode;

  children: ReactNode;

  footer?: ReactNode;

  className?: string;
}

function DashboardCard({
  title,
  icon,
  badge,
  children,
  footer,
  className,
}: DashboardCardProps) {
  return (
    <section
      className={[
        'dashboard-card',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="dashboard-card-header">
        <div className="dashboard-card-title-wrap">
          {icon ? (
            <span className="dashboard-card-icon">
              {icon}
            </span>
          ) : null}

          <h2>
            {title}
          </h2>
        </div>

        {badge ? (
          <div className="dashboard-card-badge">
            {badge}
          </div>
        ) : null}
      </header>

      <div className="dashboard-card-body">
        {children}
      </div>

      {footer ? (
        <footer className="dashboard-card-footer">
          {footer}
        </footer>
      ) : null}
    </section>
  );
}

export default DashboardCard;