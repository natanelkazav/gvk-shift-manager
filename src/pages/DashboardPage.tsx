import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  PageHeader,
  StatCard,
} from '../components/ui';

function DashboardPage() {
  return (
    <>
      <PageHeader
        title="לוח בקרה"
        description="תמונת מצב כללית של מערכת המשמרות."
        actions={
          <>
            <Button variant="secondary">
              צפייה בשיבוץ
            </Button>

            <Button>
              יצירת שיבוץ
            </Button>
          </>
        }
      />

      <div className="stats-grid">
        <StatCard
          label="משמרות החודש"
          value={0}
        />

        <StatCard
          label="מוקדנים פעילים"
          value={0}
        />

        <StatCard
          label="בקשות החלפה"
          value={0}
        />

        <StatCard
          label="התראות פעילות"
          value={0}
        />
      </div>

      <Card className="dashboard-activity-card">
        <CardHeader>
          <CardTitle>פעילות אחרונה</CardTitle>
        </CardHeader>

        <CardBody>
          <p>עדיין אין פעילות להצגה.</p>
          <Badge>המערכת בהקמה</Badge>
        </CardBody>
      </Card>
    </>
  );
}

export default DashboardPage;