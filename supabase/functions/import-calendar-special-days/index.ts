import {
  createClient,
  type User,
} from 'npm:@supabase/supabase-js@2';

type ScheduleType =
  | 'holiday_eve'
  | 'holiday_full'
  | 'holiday_end'
  | 'chol_hamoed';

interface ImportSpecialDaysRequest {
  year: number;
}

interface RequestingProfileRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
}

interface PermissionRow {
  permission_key: string;
}

interface HebcalResponse {
  title?: string;
  date?: string;
  range?: {
    start?: string;
    end?: string;
  };
  items?: HebcalEvent[];
}

interface HebcalEvent {
  title: string;
  date: string;
  category: string;
  subcat?: string;
  hebrew?: string;
  hdate?: string;
  yomtov?: boolean;
  link?: string;
  memo?: string;
}

interface CalendarSpecialDayInsert {
  event_date: string;
  event_name: string;
  schedule_type: ScheduleType;
  holiday_group: string | null;
  source_name: string;
  source_event_key: string;
  metadata: Record<string, unknown>;
}

interface MappedHoliday {
  scheduleType: ScheduleType;
  holidayGroup: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',

  'Content-Type': 'application/json',
};

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

function getRequiredEnvironmentVariable(
  variableName: string,
): string {
  const value =
    Deno.env.get(variableName);

  if (!value) {
    throw new Error(
      `Missing environment variable: ${variableName}`,
    );
  }

  return value;
}

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
function getCanonicalTitle(
  title: string,
): string {
  return normalizeTitle(title)
    .replace(/[^a-z0-9]/g, '');
}
function isCholHamoedEvent(
  event: HebcalEvent,
  normalizedTitle: string,
): boolean {
  const normalizedSubcategory =
    event.subcat
      ?.trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '') ??
    '';

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
function getDateOnly(
  dateValue: string,
): string {
  return dateValue.slice(0, 10);
}

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

function getHebrewEventName(
  event: HebcalEvent,
): string {
  const hebrewName =
    event.hebrew?.trim();

  if (hebrewName) {
    return hebrewName;
  }

  return event.title.trim();
}

function mapHebcalEvent(
  event: HebcalEvent,
): MappedHoliday | null {
  const title =
    normalizeTitle(event.title);

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
  if (
    category !== 'holiday' &&
    category !== 'modern'
  ) {
    return null;
  }

  /*
   * פסח
   */
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

async function getAuthenticatedUser(
  authorizationHeader: string,
  supabaseUrl: string,
  publishableKey: string,
): Promise<User | null> {
  const accessToken =
    authorizationHeader.replace(
      /^Bearer\s+/i,
      '',
    );

  if (!accessToken) {
    return null;
  }

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

  const {
    data: {
      user,
    },
    error,
  } =
    await authenticationClient
      .auth
      .getUser(accessToken);

  if (
    error ||
    !user
  ) {
    return null;
  }

  return user;
}

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

  const url =
    `https://www.hebcal.com/hebcal?${query.toString()}`;

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

  if (!response.ok) {
    throw new Error(
      `Hebcal returned HTTP ${response.status}`,
    );
  }

  const responseBody =
    await response.json() as
      HebcalResponse;

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

    try {
      const supabaseUrl =
        getRequiredEnvironmentVariable(
          'SUPABASE_URL',
        );

      const publishableKey =
        Deno.env.get(
          'SUPABASE_ANON_KEY',
        ) ??
        Deno.env.get(
          'SUPABASE_PUBLISHABLE_KEY',
        );

      if (!publishableKey) {
        throw new Error(
          'Missing Supabase public API key.',
        );
      }

      const serviceRoleKey =
        getRequiredEnvironmentVariable(
          'SUPABASE_SERVICE_ROLE_KEY',
        );

      const authorizationHeader =
        request.headers.get(
          'Authorization',
        );

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

      const authenticatedUser =
        await getAuthenticatedUser(
          authorizationHeader,
          supabaseUrl,
          publishableKey,
        );

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

      let requestBody:
        Partial<ImportSpecialDaysRequest>;

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

      const requestedYear =
        requestBody.year;

      const events =
        await fetchHebcalEvents(
          requestedYear,
        );

      const mappedRows:
        CalendarSpecialDayInsert[] = [];

      let skippedEvents = 0;

      for (
        const event of events
      ) {
        const mappedHoliday =
          mapHebcalEvent(event);

        if (!mappedHoliday) {
          skippedEvents += 1;
          continue;
        }

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

      const startDate =
        `${requestedYear}-01-01`;

      const endDate =
        `${requestedYear}-12-31`;

      /*
       * מוחקים רק נתונים שיובאו
       * בעבר מ-Hebcal באותה שנה.
       * רשומות ידניות אינן נמחקות.
       */
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