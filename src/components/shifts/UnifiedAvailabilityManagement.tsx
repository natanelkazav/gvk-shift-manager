import {
  ArrowLeft,
  Car,
  Headphones,
  SunMedium,
} from 'lucide-react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  Button,
  Card,
  CardBody,
} from '../ui';

interface AvailabilityCategoryDefinition {
  id:
    | 'dispatchers'
    | 'morning-drivers'
    | 'drivers';

  title: string;

  description: string;

  route: string;

  actionLabel: string;

  icon:
    typeof Headphones;

  className: string;
}

const availabilityCategories:
  AvailabilityCategoryDefinition[] = [
    {
      id:
        'dispatchers',

      title:
        'אילוצי מוקדנים',

      description:
        'פתיחת תקופה, קביעת מועד אחרון להגשה, מעקב אחר המוקדנים והכנת השיבוץ.',

      route:
        '/availability',

      actionLabel:
        'פתיחת ניהול מוקדנים',

      icon:
        Headphones,

      className:
        'unified-availability-card-dispatchers',
    },

    {
      id:
        'morning-drivers',

      title:
        'אילוצי כונני בוקר',

      description:
        'פתיחת תקופה, קביעת דדליין, מעקב אחר הגשות וניהול הזמינות של כונני הבוקר.',

      route:
        '/morning-driver-availability',

      actionLabel:
        'פתיחת ניהול כונני בוקר',

      icon:
        SunMedium,

      className:
        'unified-availability-card-morning-drivers',
    },

    {
      id:
        'drivers',

      title:
        'אילוצי כוננים',

      description:
        'ניהול זמינות הכוננים, צפייה בהגשות ובדיקת הכיסוי לפני יצירת הלוח.',

      route:
        '/driver-schedule',

      actionLabel:
        'פתיחת ניהול כוננים',

      icon:
        Car,

      className:
        'unified-availability-card-drivers',
    },
  ];

function UnifiedAvailabilityManagement() {
  const navigate =
    useNavigate();

  const handleOpenCategory =
    (
      route: string,
    ): void => {
      navigate(
        route,
      );
    };

  return (
    <section className="unified-availability-management">
      <header className="unified-availability-header">
        <div>
          <h2>
            ניהול אילוצים
          </h2>

          <p>
            ניהול תקופות ההגשה של מוקדנים, כונני בוקר וכוננים.
          </p>
        </div>
      </header>

      <div className="unified-availability-grid">
        {availabilityCategories.map(
          (
            category,
          ) => {
            const Icon =
              category.icon;

            return (
              <Card
                key={
                  category.id
                }
                className={[
                  'unified-availability-card',

                  category.className,
                ].join(
                  ' ',
                )}
              >
                <CardBody>
                  <div className="unified-availability-card-content">
                    <div className="unified-availability-card-icon">
                      <Icon
                        size={
                          25
                        }
                        aria-hidden="true"
                      />
                    </div>

                    <div className="unified-availability-card-text">
                      <h3>
                        {
                          category.title
                        }
                      </h3>

                      <p>
                        {
                          category.description
                        }
                      </p>
                    </div>
                  </div>

                  <div className="unified-availability-card-status">
                    <span className="unified-availability-status-label">
                      סטטוס
                    </span>

                    <strong>
                      יוצג בשלב הבא
                    </strong>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    className="unified-availability-card-action"
                    onClick={() =>
                      handleOpenCategory(
                        category.route,
                      )
                    }
                  >
                    {
                      category.actionLabel
                    }

                    <ArrowLeft
                      size={
                        17
                      }
                      aria-hidden="true"
                    />
                  </Button>
                </CardBody>
              </Card>
            );
          },
        )}
      </div>
    </section>
  );
}

export default UnifiedAvailabilityManagement;