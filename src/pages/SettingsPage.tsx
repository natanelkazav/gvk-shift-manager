import { Mail, User } from 'lucide-react';
import { useState } from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '../components/ui';

function SettingsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="הגדרות"
        description="בדיקת רכיבי הטפסים והממשק."
        actions={
          <Button onClick={() => setIsModalOpen(true)}>
            פתיחת חלון
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>פרטי משתמש לדוגמה</CardTitle>
        </CardHeader>

        <CardBody>
          <div className="form-grid">
            <Input
              label="שם מלא"
              placeholder="הזן שם מלא"
              startIcon={<User size={18} />}
              required
            />

            <Input
              label="כתובת אימייל"
              type="email"
              placeholder="name@example.com"
              startIcon={<Mail size={18} />}
              helperText="כתובת זו תשמש להתחברות למערכת."
            />

            <Select
              label="תפקיד"
              defaultValue=""
              placeholder="בחר תפקיד"
              options={[
                {
                  label: 'מנהל מערכת',
                  value: 'admin',
                },
                {
                  label: 'מנהל מוקד',
                  value: 'manager',
                },
                {
                  label: 'מוקדן',
                  value: 'dispatcher',
                },
                {
                  label: 'כונן',
                  value: 'driver',
                },
              ]}
            />

            <Input
              label="שדה עם שגיאה"
              error="זהו שדה חובה."
              placeholder="בדיקת הודעת שגיאה"
            />
          </div>

          <div style={{ marginTop: '20px' }}>
            <Textarea
              label="הערות"
              placeholder="הזן הערות נוספות"
              rows={4}
            />
          </div>

          <div className="form-actions">
            <Button variant="secondary">ביטול</Button>
            <Button>שמירה</Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        isOpen={isModalOpen}
        title="חלון בדיקה"
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
            >
              ביטול
            </Button>

            <Button onClick={() => setIsModalOpen(false)}>
              אישור
            </Button>
          </>
        }
      >
        <p>זהו חלון מודאלי שישמש אותנו ברחבי המערכת.</p>

        <Input
          label="שם ההגדרה"
          placeholder="הזן שם"
        />
      </Modal>
    </>
  );
}

export default SettingsPage;