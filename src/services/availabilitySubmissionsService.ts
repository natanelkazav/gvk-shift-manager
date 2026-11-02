/**
 * קובץ: src/services/availabilitySubmissionsService.ts
 * מטרה: טעינת סטטוסי ההגשה של אילוצי עובדים לצורך ניהול ומעקב.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AvailabilityPeriodSubmissionDatabaseRow, mapDispatcherRow, getPeriodSubmissions.
 * - קריאות RPC המופעלות בקובץ: get_availability_period_submissions.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import { supabase } from '../lib/supabase';
import type {
  AvailabilityPeriodSubmissionsTracking,
  AvailabilitySubmissionTrackingDispatcher,
  AvailabilityTrackingStatus,
} from '../types/availabilitySubmissions';

/**
 * חוזה הנתונים AvailabilityPeriodSubmissionDatabaseRow: תקופת אילוצים.
 */
interface AvailabilityPeriodSubmissionDatabaseRow {
  // period_id — מזהה התקופה.
  period_id: string;
  // period_year — תקופה / שנה.
  period_year: number;
  // period_month — תקופה / חודש.
  period_month: number;
  // period_title — תקופה / כותרת.
  period_title: string | null;
  // period_status — תקופה / סטטוס.
  period_status: string;
  // submission_deadline — מועד אחרון להגשת אילוצים.
  submission_deadline: string | null;

  // total_dispatchers — סך הכול.
  total_dispatchers: number;
  // submitted_dispatchers — הוגש.
  submitted_dispatchers: number;
  // draft_dispatchers — טיוטה.
  draft_dispatchers: number;
  not_started_dispatchers: number;

  // user_id — מזהה משתמש.
  user_id: string;
  // display_name — שם תצוגה.
  display_name: string;
  // email — כתובת דוא״ל.
  email: string;
  // schedule_name — שיבוץ / שם.
  schedule_name: string | null;

  // submission_status — מצב ההגשה.
  submission_status:
    AvailabilityTrackingStatus;

  // submitted_at — הוגש.
  submitted_at: string | null;
  last_saved_at: string | null;

  // available_count — מספר הסימונים כזמין.
  available_count: number;
  // unavailable_count — מספר הסימונים כלא זמין.
  unavailable_count: number;
  // answered_count — כמות.
  answered_count: number;
  // unanswered_count — כמות.
  unanswered_count: number;
  // total_shift_count — סך הכול / משמרת / כמות.
  total_shift_count: number;
  completion_percentage: number;
}

/**
 * פעולה mapDispatcherRow: מיפוי מפת התאמה / מוקדנים / שורה.
 * @param row — שורה.
 * @returns AvailabilitySubmissionTrackingDispatcher — הפלט בהתאם לחתימה.
 */
function mapDispatcherRow(
  row:
    AvailabilityPeriodSubmissionDatabaseRow,
): AvailabilitySubmissionTrackingDispatcher {
  return {
    userId:
      row.user_id,

    displayName:
      row.display_name,

    email:
      row.email,

    scheduleName:
      row.schedule_name,

    status:
      row.submission_status,

    submittedAt:
      row.submitted_at,

    lastSavedAt:
      row.last_saved_at,

    availableCount:
      row.available_count,

    unavailableCount:
      row.unavailable_count,

    answeredCount:
      row.answered_count,

    unansweredCount:
      row.unanswered_count,

    totalShiftCount:
      row.total_shift_count,

    completionPercentage:
      row.completion_percentage,
  };
}

/**
 * פעולה אסינכרונית getPeriodSubmissions: שליפה או חישוב של תקופה.
 * הפעולה פונה ל־RPC: get_availability_period_submissions.
 * @param periodId — מזהה התקופה.
 * @returns Promise<AvailabilityPeriodSubmissionsTracking> — הפלט בהתאם לחתימה.
 */
async function getPeriodSubmissions(
  periodId: string,
): Promise<AvailabilityPeriodSubmissionsTracking> {
  // normalizedPeriodId — מזהה התקופה.
  const normalizedPeriodId =
    periodId.trim();

  // עצירת הפעולה עם שגיאה כאשר !normalizedPeriodId.
  if (!normalizedPeriodId) {
    throw new Error(
      'לא התקבל מזהה תקופת אילוצים תקין.',
    );
  }

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data,
    error,
  } = await supabase.rpc(
    'get_availability_period_submissions',
    {
      requested_period_id:
        normalizedPeriodId,
    },
  );

  // עצירת הפעולה עם שגיאה כאשר error.
  if (error) {
    console.error(
      'GET AVAILABILITY PERIOD SUBMISSIONS ERROR:',
      {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      },
    );

    // normalizedMessage — הודעה.
    const normalizedMessage =
      error.message.toLowerCase();

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not authenticated', ).
    if (
      normalizedMessage.includes(
        'not authenticated',
      )
    ) {
      throw new Error(
        'לא נמצאה התחברות פעילה. יש להתחבר מחדש.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not active', ).
    if (
      normalizedMessage.includes(
        'not active',
      )
    ) {
      throw new Error(
        'המשתמש אינו פעיל.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not allowed', ).
    if (
      normalizedMessage.includes(
        'not allowed',
      )
    ) {
      throw new Error(
        'אין לך הרשאה לצפות במעקב ההגשות.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר normalizedMessage.includes( 'not found', ).
    if (
      normalizedMessage.includes(
        'not found',
      )
    ) {
      throw new Error(
        'תקופת האילוצים לא נמצאה.',
      );
    }

    throw new Error(
      'לא ניתן היה לטעון את מעקב ההגשות.',
    );
  }

  // rows — שורות.
  const rows =
    (
      data as
        | AvailabilityPeriodSubmissionDatabaseRow[]
        | null
    ) ?? [];

  // עצירת הפעולה עם שגיאה כאשר rows.length === 0.
  if (rows.length === 0) {
    throw new Error(
      'לא נמצאו נתוני הגשה עבור תקופת האילוצים.',
    );
  }

  // firstRow — שורה.
  const firstRow =
    rows[0];

  return {
    period: {
      id:
        firstRow.period_id,

      year:
        firstRow.period_year,

      month:
        firstRow.period_month,

      title:
        firstRow.period_title,

      status:
        firstRow.period_status,

      submissionDeadline:
        firstRow.submission_deadline,
    },

    summary: {
      totalDispatchers:
        firstRow.total_dispatchers,

      submittedDispatchers:
        firstRow.submitted_dispatchers,

      draftDispatchers:
        firstRow.draft_dispatchers,

      notStartedDispatchers:
        firstRow.not_started_dispatchers,
    },

    dispatchers:
      rows.map(
        mapDispatcherRow,
      ),
  };
}

// availabilitySubmissionsService — אילוצים וזמינות / שירות.
export const availabilitySubmissionsService = {
  getPeriodSubmissions,
};