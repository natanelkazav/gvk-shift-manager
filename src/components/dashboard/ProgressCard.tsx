import {
  BarChart3,
} from 'lucide-react';

import DashboardCard
  from './DashboardCard';

interface ProgressCardProps {
  title: string;

  completed: number;

  total: number;

  percentage: number;

  unitLabel: string;
}

function normalizePercentage(
  value: number,
): number {
  if (
    !Number.isFinite(
      value,
    )
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      value,
    ),
  );
}

function ProgressCard({
  title,
  completed,
  total,
  percentage,
  unitLabel,
}: ProgressCardProps) {
  const normalizedPercentage =
    normalizePercentage(
      percentage,
    );

  return (
    <DashboardCard
      title={
        title
      }
      icon={
        <BarChart3
          size={20}
          aria-hidden="true"
        />
      }
    >
      <div className="dashboard-progress-card">
        <div className="dashboard-progress-summary">
          <strong>
            {normalizedPercentage.toFixed(
              normalizedPercentage %
                1 ===
                0
                ? 0
                : 1,
            )}
            %
          </strong>

          <span>
            {completed} מתוך {total}{' '}
            {unitLabel}
          </span>
        </div>

        <div
          className="dashboard-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={
            normalizedPercentage
          }
        >
          <span
            style={{
              width:
                `${normalizedPercentage}%`,
            }}
          />
        </div>
      </div>
    </DashboardCard>
  );
}

export default ProgressCard;