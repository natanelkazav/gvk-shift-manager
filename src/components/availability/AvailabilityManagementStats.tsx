import {
  type LucideIcon,
} from 'lucide-react';

interface AvailabilityManagementStat {
  label: string;
  value: number | string;
  icon: LucideIcon;
}

interface AvailabilityManagementStatsProps {
  items:
    AvailabilityManagementStat[];
}

function AvailabilityManagementStats({
  items,
}: AvailabilityManagementStatsProps) {
  return (
    <div className="availability-management-stats">
      {items.map(
        (
          item,
        ) => {
          const Icon =
            item.icon;

          return (
            <article
              key={
                item.label
              }
            >
              <Icon
                size={21}
                aria-hidden="true"
              />

              <div>
                <strong>
                  {item.value}
                </strong>

                <span>
                  {item.label}
                </span>
              </div>
            </article>
          );
        },
      )}
    </div>
  );
}

export default AvailabilityManagementStats;
