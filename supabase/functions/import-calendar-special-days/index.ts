/**
 * קובץ: supabase/functions/import-calendar-special-days/index.ts
 * מטרה: טיפול בבקשות HTTP לפעולת השרת import-calendar-special-days.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ScheduleType, ImportSpecialDaysRequest, RequestingProfileRow, PermissionRow, HebcalResponse, HebcalEvent, CalendarSpecialDayInsert, MappedHoliday, createJsonResponse, getRequiredEnvironmentVariable ועוד.
 * - מקורות נתונים הנזכרים בקריאות from: profiles, user_permissions, calendar_special_days.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  createClient,
  type User,
} from 'npm:@supabase/supabase-js@2';

/**
 * טיפוס ScheduleType: סוג יום השיבוץ.
 */
type ScheduleType =
  | 'holiday_eve'
  | 'holiday_full'
  | 'holiday_end'
  | 'chol_hamoed';

/**
 * חוזה הנתונים ImportSpecialDaysRequest: ייבוא / ימים / נתוני הבקשה.
 */
interface ImportSpecialDaysRequest {
  // year — שנה.
  year: number;
}

/**
 * חוזה הנתונים RequestingProfileRow: פרופיל / שורה.
 */
interface RequestingProfileRow {
  // id — מזהה.
  id: string;
  // email — כתובת דוא״ל.
  email: string;
  // display_name — שם תצוגה.
  display_name: string;
  role: string;
  // is_active — האם הרשומה פעילה.
  is_active: boolean;
}

/**
 * חוזה הנתונים PermissionRow: הרשאות / שורה.
 */
interface PermissionRow {
  // permission_key — מפתח ההרשאה.
  permission_key: string;
}

/**
 * חוזה הנתונים HebcalResponse: תוצאת הפעולה.
 */
interface HebcalResponse {
  // title — כותרת (אופציונלי).
  title?: string;
  // date — תאריך (אופציונלי).
  date?: string;
  range?: {
    start?: string;
    end?: string;
  };
  // items — פריטים (אופציונלי).
  items?: HebcalEvent[];
}

/**
 * חוזה הנתונים HebcalEvent: אירוע.
 */
interface HebcalEvent {
  // title — כותרת.
  title: string;
  // date — תאריך.
  date: string;
  category: string;
  subcat?: string;
  hebrew?: string;
  hdate?: string;
  yomtov?: boolean;
  link?: string;
  memo?: string;
}

/**
 * חוזה הנתונים CalendarSpecialDayInsert: לוח שנה / יום.
 */
interface CalendarSpecialDayInsert {
  // event_date — אירוע / תאריך.
  event_date: string;
  // event_name — אירוע / שם.
  event_name: string;
  // schedule_type — סוג יום השיבוץ.
  schedule_type: ScheduleType;
  // holiday_group — חג / קבוצה.
  holiday_group: string | null;
  // source_name — מקור / שם.
  source_name: string;
  // source_event_key — מקור / אירוע / מפתח.
  source_event_key: string;
  metadata: Record<string, unknown>;
}

/**
 * חוזה הנתונים MappedHoliday: חג.
 */
interface MappedHoliday {
  // scheduleType — סוג יום השיבוץ.
  scheduleType: ScheduleType;
  // holidayGroup — חג / קבוצה.
  holidayGroup: string;
}

// corsHeaders — הנתון corsHeaders בהקשר הפעולה.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',

  'Content-Type': 'application/json',
};

/**
 * פעולה createJsonResponse: יצירת תוצאת הפעולה.
 * @param body — תוכן.
 * @param status — סטטוס.
 * @returns Response — הפלט בהתאם לחתימה.
 */
function createJsonResponse(
  body: unknown,
  status: number,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: corsHeaders,
    },
  );
}

/**
 * פעולה getRequiredEnvironmentVariable: שליפה או חישוב של הנתון getRequiredEnvironmentVariable בהקשר הפעולה.
 * @param variableName — שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getRequiredEnvironmentVariable(
  variableName: string,
): string {
  // value — ערך.
  const value =
    Deno.env.get(variableName);

  // עצירת הפעולה עם שגיאה כאשר !value.
  if (!value) {
    throw new Error(
      `Missing environment variable: ${variableName}`,
    );
  }

  return value;
}

/**
 * פעולה validateYear: בדיקת תקינות של שנה.
 * @param year — שנה.
 * @returns year is number — הפלט בהתאם לחתימה.
 */
function validateYear(
  year: unknown,
): year is number {
  return (
    typeof year === 'number' &&
    Number.isInteger(year) &&
    year >= 2020 &&
    year <= 2200
  );
}

/**
 * פעולה normalizeTitle: נרמול כותרת.
 * @param title — כותרת.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeTitle(
  title: string,
): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[״“”]/g, '"')
    .replace(/\s+/g, ' ');
}
/**
 * פעולה getCanonicalTitle: שליפה או חישוב של כותרת.
 * @param title — כותרת.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getCanonicalTitle(
  title: string,
): string {
  return normalizeTitle(title)
    .replace(/[^a-z0-9]/g, '');
}
/**
 * פעולה isCholHamoedEvent: בדיקת תנאי עבור אירוע.
 * @param event — אירוע.
 * @param normalizedTitle — כותרת.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
function isCholHamoedEvent(
  event: HebcalEvent,
  normalizedTitle: string,
): boolean {
  // normalizedSubcategory — הנתון normalizedSubcategory בהקשר הפעולה.
  const normalizedSubcategory =
    event.subcat
      ?.trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '') ??
    '';

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר normalizedSubcategory === 'cholhamoed' || normalizedSubcategory === 'cholhamoedday'.
  if (
    normalizedSubcategory ===
      'cholhamoed' ||
    normalizedSubcategory ===
      'cholhamoedday'
  ) {
    return true;
  }

  return (
    normalizedTitle.includes(
      'chol hamoed',
    ) ||
    normalizedTitle.includes(
      'chol ha-moed',
    ) ||
    normalizedTitle.includes(
      "(ch''m)",
    ) ||
    normalizedTitle.includes(
      '(ch"m)',
    ) ||
    normalizedTitle.includes(
      "(ch'm)",
    )
  );
}
/**
 * פעולה getDateOnly: שליפה או חישוב של תאריך.
 * @param dateValue — תאריך / ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getDateOnly(
  dateValue: string,
): string {
  return dateValue.slice(0, 10);
}

/**
 * פעולה buildSourceEventKey: הרכבת מקור / אירוע / מפתח.
 * @param year — שנה.
 * @param event — אירוע.
 * @param scheduleType — סוג יום השיבוץ.
 * @returns string — הפלט בהתאם לחתימה.
 */
function buildSourceEventKey(
  year: number,
  event: HebcalEvent,
  scheduleType: ScheduleType,
): string {
  return [
    'hebcal',
    year,
    getDateOnly(event.date),
    scheduleType,
    event.title,
  ].join(':');
}

/**
 * פעולה getHebrewEventName: שליפה או חישוב של אירוע / שם.
 * @param event — אירוע.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getHebrewEventName(
  event: HebcalEvent,
): string {
  // hebrewName — שם.
  const hebrewName =
    event.hebrew?.trim();

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר hebrewName.
  if (hebrewName) {
    return hebrewName;
  }

  return event.title.trim();
}

/**
 * פעולה mapHebcalEvent: מיפוי מפת התאמה / אירוע.
 * @param event — אירוע.
 * @returns MappedHoliday | null — הפלט בהתאם לחתימה.
 */
function mapHebcalEvent(
  event: HebcalEvent,
): MappedHoliday | null {
  // title — כותרת.
  const title =
    normalizeTitle(event.title);

  // canonicalTitle — כותרת.
  const canonicalTitle =
    getCanonicalTitle(
      event.title,
    );

  const category =
    event.category
      .trim()
      .toLowerCase();

  /*
   * ימים מודרניים בישראל.
   *
   * הבדיקה מתבצעת לפני סינון
   * הקטגוריה, ובאמצעות כותרת
   * ללא רווחים וסימני פיסוק.
   */
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר canonicalTitle === 'yomhaatzmaut'.
  if (
    canonicalTitle ===
    'yomhaatzmaut'
  ) {
    return {
      scheduleType:
        'holiday_full',

      holidayGroup:
        'yom_haatzmaut',
    };
  }

  /*
   * כרגע שומרים רק חגים
   * וימים מודרניים שמופו
   * במפורש.
   */
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר category !== 'holiday' && category !== 'modern'.
  if (
    category !== 'holiday' &&
    category !== 'modern'
  ) {
    return null;
  }

  /*
   * פסח
   */
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title === 'erev pesach'.
  if (
    title === 'erev pesach'
  ) {
    return {
      scheduleType:
        'holiday_eve',

      holidayGroup:
        'pesach',
    };
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title.includes('pesach') && isCholHamoedEvent( event, title, ).
  if (
    title.includes('pesach') &&
    isCholHamoedEvent(
      event,
      title,
    )
  ) {
    return {
      scheduleType:
        'chol_hamoed',

      holidayGroup:
        'pesach',
    };
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title === 'pesach i'.
  if (
    title === 'pesach i'
  ) {
    return {
      scheduleType:
        'holiday_full',

      holidayGroup:
        'pesach',
    };
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title === 'pesach vii'.
  if (
    title === 'pesach vii'
  ) {
    return {
      scheduleType:
        'holiday_end',

      holidayGroup:
        'pesach',
    };
  }

  /*
   * שבועות
   */
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title === 'erev shavuot'.
  if (
    title === 'erev shavuot'
  ) {
    return {
      scheduleType:
        'holiday_eve',

      holidayGroup:
        'shavuot',
    };
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title === 'shavuot' || title === 'shavuot i'.
  if (
    title === 'shavuot' ||
    title === 'shavuot i'
  ) {
    return {
      scheduleType:
        'holiday_end',

      holidayGroup:
        'shavuot',
    };
  }

  /*
   * ראש השנה
   */
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title === 'erev rosh hashana'.
  if (
    title ===
    'erev rosh hashana'
  ) {
    return {
      scheduleType:
        'holiday_eve',

      holidayGroup:
        'rosh_hashana',
    };
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title === 'rosh hashana ii'.
  if (
    title ===
    'rosh hashana ii'
  ) {
    return {
      scheduleType:
        'holiday_end',

      holidayGroup:
        'rosh_hashana',
    };
  }

  /*
   * היום הראשון מגיע בדרך כלל
   * כ־Rosh Hashana 5787.
   *
   * התנאי המדויק מונע סיווג שגוי
   * של Rosh Hashana LaBehemot.
   */
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר /^rosh hashana \d+$/.test( title, ) || title === 'rosh hashana i'.
  if (
    /^rosh hashana \d+$/.test(
      title,
    ) ||
    title ===
      'rosh hashana i'
  ) {
    return {
      scheduleType:
        'holiday_full',

      holidayGroup:
        'rosh_hashana',
    };
  }

  /*
   * יום כיפור
   */
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title === 'erev yom kippur'.
  if (
    title ===
    'erev yom kippur'
  ) {
    return {
      scheduleType:
        'holiday_eve',

      holidayGroup:
        'yom_kippur',
    };
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title === 'yom kippur'.
  if (
    title === 'yom kippur'
  ) {
    return {
      scheduleType:
        'holiday_end',

      holidayGroup:
        'yom_kippur',
    };
  }

  /*
   * סוכות
   */
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title === 'erev sukkot'.
  if (
    title === 'erev sukkot'
  ) {
    return {
      scheduleType:
        'holiday_eve',

      holidayGroup:
        'sukkot',
    };
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title.includes('sukkot') && ( isCholHamoedEvent( event, title, ) || title.includes( 'hoshana raba', ) || title.includes( 'hoshana rabbah', ).
  if (
    title.includes('sukkot') &&
    (
      isCholHamoedEvent(
        event,
        title,
      ) ||
      title.includes(
        'hoshana raba',
      ) ||
      title.includes(
        'hoshana rabbah',
      )
    )
  ) {
    return {
      scheduleType:
        'chol_hamoed',

      holidayGroup:
        'sukkot',
    };
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title === 'sukkot i'.
  if (
    title === 'sukkot i'
  ) {
    return {
      scheduleType:
        'holiday_full',

      holidayGroup:
        'sukkot',
    };
  }

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר title === 'shmini atzeret' || title === 'shmini atzeret / simchat torah'.
  if (
    title ===
      'shmini atzeret' ||
    title ===
      'shmini atzeret / simchat torah'
  ) {
    return {
      scheduleType:
        'holiday_end',

      holidayGroup:
        'sukkot',
    };
  }

  return null;
}

/**
 * פעולה אסינכרונית getAuthenticatedUser: שליפה או חישוב של משתמש.
 * @param authorizationHeader — הנתון authorizationHeader בהקשר הפעולה.
 * @param supabaseUrl — כתובת יעד.
 * @param publishableKey — מפתח.
 * @returns Promise<User | null> — הפלט בהתאם לחתימה.
 */
async function getAuthenticatedUser(
  authorizationHeader: string,
  supabaseUrl: string,
  publishableKey: string,
): Promise<User | null> {
  // accessToken — אסימון גישה.
  const accessToken =
    authorizationHeader.replace(
      /^Bearer\s+/i,
      '',
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !accessToken.
  if (!accessToken) {
    return null;
  }

  // authenticationClient — אימות משתמשים / לקוח.
  const authenticationClient =
    createClient(
      supabaseUrl,
      publishableKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

  // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
  const {
    data: {
      user,
    },
    error,
  } =
    await authenticationClient
      .auth
      .getUser(accessToken);

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error || !user.
  if (
    error ||
    !user
  ) {
    return null;
  }

  return user;
}

/**
 * פעולה אסינכרונית fetchHebcalEvents: טעינת הנתון fetchHebcalEvents בהקשר הפעולה.
 * @param year — שנה.
 * @returns Promise<HebcalEvent[]> — הפלט בהתאם לחתימה.
 */
async function fetchHebcalEvents(
  year: number,
): Promise<HebcalEvent[]> {
  const query =
    new URLSearchParams({
      v: '1',
      cfg: 'json',

      year:
        String(year),

      yt: 'G',
      month: 'x',

      /*
       * לוח ישראל.
       */
      i: 'on',

      /*
       * חגים מרכזיים.
       */
      maj: 'on',

      /*
       * מועדים משניים.
       */
      min: 'on',

      /*
       * מועדים נוספים.
       */
      mod: 'on',

      /*
       * ימים מודרניים בישראל,
       * לרבות יום העצמאות.
       */
      nx: 'on',
    });

  // url — כתובת יעד.
  const url =
    `https://www.hebcal.com/hebcal?${query.toString()}`;

  // response — תוצאת הפעולה.
  const response =
    await fetch(
      url,
      {
        headers: {
          Accept:
            'application/json',
        },
      },
    );

  // עצירת הפעולה עם שגיאה כאשר !response.ok.
  if (!response.ok) {
    throw new Error(
      `Hebcal returned HTTP ${response.status}`,
    );
  }

  // responseBody — תוצאת הפעולה / תוכן.
  const responseBody =
    await response.json() as
      HebcalResponse;

  // עצירת הפעולה עם שגיאה כאשר !Array.isArray( responseBody.items, ).
  if (
    !Array.isArray(
      responseBody.items,
    )
  ) {
    throw new Error(
      'Hebcal returned an invalid response.',
    );
  }

  return responseBody.items;
}

Deno.serve(
  async (
    request: Request,
  ) => {
    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר request.method === 'OPTIONS'.
    if (
      request.method === 'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          headers:
            corsHeaders,
        },
      );
    }

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר request.method !== 'POST'.
    if (
      request.method !== 'POST'
    ) {
      return createJsonResponse(
        {
          error:
            'Method not allowed.',
        },
        405,
      );
    }

    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      // supabaseUrl — כתובת יעד.
      const supabaseUrl =
        getRequiredEnvironmentVariable(
          'SUPABASE_URL',
        );

      // publishableKey — מפתח.
      const publishableKey =
        Deno.env.get(
          'SUPABASE_ANON_KEY',
        ) ??
        Deno.env.get(
          'SUPABASE_PUBLISHABLE_KEY',
        );

      // עצירת הפעולה עם שגיאה כאשר !publishableKey.
      if (!publishableKey) {
        throw new Error(
          'Missing Supabase public API key.',
        );
      }

      // serviceRoleKey — שירות / מפתח.
      const serviceRoleKey =
        getRequiredEnvironmentVariable(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

      const authorizationHeader =
        request.headers.get(
          'Authorization',
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !authorizationHeader.
      if (
        !authorizationHeader
      ) {
        return createJsonResponse(
          {
            error:
              'לא התקבלה הרשאת משתמש.',
          },
          401,
        );
      }

      // authenticatedUser — משתמש.
      const authenticatedUser =
        await getAuthenticatedUser(
          authorizationHeader,
          supabaseUrl,
          publishableKey,
        );

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !authenticatedUser.
      if (
        !authenticatedUser
      ) {
        return createJsonResponse(
          {
            error:
              'ההתחברות אינה תקפה או שפג תוקפה.',
          },
          401,
        );
      }

      // adminClient — לקוח.
      const adminClient =
        createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              autoRefreshToken:
                false,

              persistSession:
                false,
            },
          },
        );

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        data:
          requestingProfile,

        error:
          requestingProfileError,
      } =
        await adminClient
          .from('profiles')
          .select(`
            id,
            email,
            display_name,
            role,
            is_active
          `)
          .eq(
            'id',
            authenticatedUser.id,
          )
          .maybeSingle<
            RequestingProfileRow
          >();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר requestingProfileError || !requestingProfile.
      if (
        requestingProfileError ||
        !requestingProfile
      ) {
        return createJsonResponse(
          {
            error:
              'לא נמצא פרופיל עבור המשתמש המחובר.',
          },
          403,
        );
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !requestingProfile .is_active.
      if (
        !requestingProfile
          .is_active
      ) {
        return createJsonResponse(
          {
            error:
              'המשתמש המחובר אינו פעיל.',
          },
          403,
        );
      }

      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        data:
          managementPermission,

        error:
          permissionError,
      } =
        await adminClient
          .from(
            'user_permissions',
          )
          .select(
            'permission_key',
          )
          .eq(
            'user_id',
            requestingProfile.id,
          )
          .eq(
            'permission_key',
            'availability.manage',
          )
          .maybeSingle<
            PermissionRow
          >();

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר permissionError || !managementPermission.
      if (
        permissionError ||
        !managementPermission
      ) {
        return createJsonResponse(
          {
            error:
              'אין לך הרשאה לייבא חגים ומועדים.',
          },
          403,
        );
      }

      // requestBody — נתוני הבקשה / תוכן.
      let requestBody:
        Partial<ImportSpecialDaysRequest>;

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        requestBody =
          await request.json();
      } catch {
        return createJsonResponse(
          {
            error:
              'גוף הבקשה אינו תקין.',
          },
          400,
        );
      }

      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !validateYear( requestBody.year, ).
      if (
        !validateYear(
          requestBody.year,
        )
      ) {
        return createJsonResponse(
          {
            error:
              'שנת הייבוא אינה תקינה.',
          },
          400,
        );
      }

      // requestedYear — שנה.
      const requestedYear =
        requestBody.year;

      const events =
        await fetchHebcalEvents(
          requestedYear,
        );

      // mappedRows — שורות.
      const mappedRows:
        CalendarSpecialDayInsert[] = [];

      let skippedEvents = 0;

      // עיבוד כל פריט מתוך events בנפרד.
      for (
        const event of events
      ) {
        // mappedHoliday — חג.
        const mappedHoliday =
          mapHebcalEvent(event);

        if (!mappedHoliday) {
          skippedEvents += 1;
          continue;
        }

        // eventDate — אירוע / תאריך.
        const eventDate =
          getDateOnly(
            event.date,
          );

        mappedRows.push({
          event_date:
            eventDate,

          event_name:
            getHebrewEventName(
              event,
            ),

          schedule_type:
            mappedHoliday
              .scheduleType,

          holiday_group:
            mappedHoliday
              .holidayGroup,

          source_name:
            'hebcal',

          source_event_key:
            buildSourceEventKey(
              requestedYear,
              event,
              mappedHoliday
                .scheduleType,
            ),

          metadata: {
            original_title:
              event.title,

            hebrew_title:
              event.hebrew ??
              null,

            category:
              event.category,

            subcategory:
              event.subcat ??
              null,

            hebrew_date:
              event.hdate ??
              null,

            yomtov:
              event.yomtov ??
              false,

            link:
              event.link ??
              null,

            memo:
              event.memo ??
              null,

            imported_by:
              requestingProfile.id,

            imported_at:
              new Date()
                .toISOString(),
          },
        });
      }

      // startDate — תאריך.
      const startDate =
        `${requestedYear}-01-01`;

      // endDate — תאריך.
      const endDate =
        `${requestedYear}-12-31`;

      /*
       * מוחקים רק נתונים שיובאו
       * בעבר מ-Hebcal באותה שנה.
       * רשומות ידניות אינן נמחקות.
       */
      // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
      const {
        error:
          deleteExistingError,
      } =
        await adminClient
          .from(
            'calendar_special_days',
          )
          .delete()
          .eq(
            'source_name',
            'hebcal',
          )
          .gte(
            'event_date',
            startDate,
          )
          .lte(
            'event_date',
            endDate,
          );

      // עצירת הפעולה עם שגיאה כאשר deleteExistingError.
      if (
        deleteExistingError
      ) {
        console.error(
          'DELETE EXISTING SPECIAL DAYS ERROR:',
          deleteExistingError,
        );

        throw new Error(
          'לא ניתן היה לנקות את נתוני החגים הקודמים.',
        );
      }

      if (
        mappedRows.length > 0
      ) {
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const {
          error:
            insertSpecialDaysError,
        } =
          await adminClient
            .from(
              'calendar_special_days',
            )
            .insert(
              mappedRows,
            );

        // עצירת הפעולה עם שגיאה כאשר insertSpecialDaysError.
        if (
          insertSpecialDaysError
        ) {
          console.error(
            'INSERT SPECIAL DAYS ERROR:',
            insertSpecialDaysError,
          );

          throw new Error(
            'לא ניתן היה לשמור את החגים והמועדים.',
          );
        }
      }

      return createJsonResponse(
        {
          success: true,

          year:
            requestedYear,

          fetchedEvents:
            events.length,

          importedEvents:
            mappedRows.length,

          skippedEvents,

          importedDays:
            mappedRows.map(
              (row) => ({
                date:
                  row.event_date,

                name:
                  row.event_name,

                scheduleType:
                  row.schedule_type,

                holidayGroup:
                  row.holiday_group,
              }),
            ),
        },
        200,
      );
    } catch (error) {
      console.error(
        'IMPORT CALENDAR SPECIAL DAYS ERROR:',
        error,
      );

      return createJsonResponse(
        {
          error:
            error instanceof Error
              ? error.message
              : 'אירעה שגיאה בלתי צפויה בייבוא החגים.',
        },
        500,
      );
    }
  },
);