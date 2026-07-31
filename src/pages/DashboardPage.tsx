import {
  useEffect,
  useState,
} from 'react';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';
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

interface DashboardLocationState {
  accessDenied?: boolean;
  attemptedPath?: string;
}

function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const locationState =
    location.state as
      | DashboardLocationState
      | null;

  const [
    accessDeniedMessage,
    setAccessDeniedMessage,
  ] = useState<string | null>(
    locationState?.accessDenied
      ? 'אין לך הרשאה לגשת למסך זה.'
      : null,
  );

  useEffect(() => {
    if (!locationState?.accessDenied) {
      return;
    }

    navigate(location.pathname, {
      replace: true,
      state: null,
    });
  }, [
    location.pathname,
    locationState?.accessDenied,
    navigate,
  ]);

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

      {accessDeniedMessage ? (
        <div
          className="users-error"
          role="alert"
        >
          <span>
            {accessDeniedMessage}
          </span>

          <button
            type="button"
            onClick={() => {
              setAccessDeniedMessage(
                null,
              );
            }}
            aria-label="סגירת הודעת הרשאה"
          >
            ×
          </button>
        </div>
      ) : null}

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
          <CardTitle>
            פעילות אחרונה
          </CardTitle>
        </CardHeader>

        <CardBody>
          <p>
            עדיין אין פעילות להצגה.
          </p>

          <Badge>
            המערכת בהקמה
          </Badge>
        </CardBody>
      </Card>
    </>
  );
}

export default DashboardPage;