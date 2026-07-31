import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string | number;
}

function StatCard({
  label,
  value,
}: StatCardProps) {
  return (
    <Card className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </Card>
  );
}

export default StatCard;