/**
 * קובץ: src/services/scheduleImportIdentityService.ts
 * מטרה: התאמת שמות וזהויות המגיעים מקובץ שיבוץ למשתמשי המערכת.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: SupabaseErrorShape, normalizeScheduleImportIdentityError, normalizeImportNameStrict, normalizeImportNameTypoFallback, getUserNameCandidates, findUserById, findUniqueUserMatch, findExactUserMatch, findConservativeTypoMatch, resolveImportName ועוד.
 * - קריאות RPC המופעלות בקובץ: get_schedule_import_users, save_schedule_import_name_alias.
 * - ריכוז הפנייה למקור הנתונים ועיבוד התשובה בהתאם לפונקציות להלן.
 */
import {
  supabase,
} from '../lib/supabase';

import type {
  SaveScheduleImportNameAliasRequest,
  SaveScheduleImportNameAliasResponse,
  ScheduleImportNameAlias,
  ScheduleImportResolvedName,
  ScheduleImportUser,
  ScheduleImportUsersData,
  ScheduleImportUserType,
} from '../types/scheduleImport';

/**
 * חוזה הנתונים SupabaseErrorShape: שגיאה.
 */
interface SupabaseErrorShape {
  // message — הודעה (אופציונלי).
  message?: unknown;

  details?: unknown;

  hint?: unknown;

  code?: unknown;
}

/**
 * פעולה normalizeScheduleImportIdentityError: נרמול שיבוץ / ייבוא / שגיאה.
 * @param error — שגיאה.
 * @returns Error — הפלט בהתאם לחתימה.
 */
function normalizeScheduleImportIdentityError(
  error: unknown,
): Error {
  console.error(
    'Schedule import identity error:',
    error,
  );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    return error;
  }

  if (
    typeof error ===
      'object' &&
    error !== null
  ) {
    // databaseError — שגיאה.
    const databaseError =
      error as
        SupabaseErrorShape;

    // errorParts — שגיאה.
    const errorParts = [
      typeof databaseError
        .message ===
        'string' &&
      databaseError
        .message
        .trim()
        ? databaseError.message
        : null,

      typeof databaseError
        .details ===
        'string' &&
      databaseError
        .details
        .trim()
        ? databaseError.details
        : null,

      typeof databaseError
        .hint ===
        'string' &&
      databaseError
        .hint
        .trim()
        ? `Hint: ${databaseError.hint}`
        : null,

      typeof databaseError
        .code ===
        'string' &&
      databaseError
        .code
        .trim()
        ? `Code: ${databaseError.code}`
        : null,
    ].filter(
      (
        errorPart,
      ): errorPart is string =>
        Boolean(errorPart),
    );

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר errorParts.length > 0.
    if (
      errorParts.length >
      0
    ) {
      return new Error(
        errorParts.join(
          ' | ',
        ),
      );
    }
  }

  return new Error(
    'אירעה שגיאה בעת טעינת משתמשי הייבוא.',
  );
}

/**
 * פעולה normalizeImportNameStrict: נרמול ייבוא / שם.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeImportNameStrict(
  value: string,
): string {
  return value
    .replace(
      /\u00a0/g,
      ' ',
    )
    .replace(
      /[״"'׳]/g,
      '',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim()
    .toLocaleLowerCase(
      'he-IL',
    );
}

/**
 * Normalization used only as a conservative typo fallback.
 *
 * Important:
 * - Exact schedule_name/display_name matching is always attempted first.
 * - Different initials remain different identities:
 *   "אולג מ" !== "אולג ג".
 * - Final-letter normalization is allowed only when it produces exactly
 *   one possible user, e.g. historical typo "אולג ם" -> "אולג מ".
 */
/**
 * פעולה normalizeImportNameTypoFallback: נרמול ייבוא / שם.
 * @param value — ערך.
 * @returns string — הפלט בהתאם לחתימה.
 */
function normalizeImportNameTypoFallback(
  value: string,
): string {
  return normalizeImportNameStrict(
    value,
  ).replace(
    /[ךםןףץ]/g,
    (character) => {
      // finalLetterMap — מפת התאמה.
      const finalLetterMap:
        Record<
          string,
          string
        > = {
          ך: 'כ',
          ם: 'מ',
          ן: 'נ',
          ף: 'פ',
          ץ: 'צ',
        };

      return finalLetterMap[
        character
      ] ??
        character;
    },
  );
}

/**
 * פעולה getUserNameCandidates: שליפה או חישוב של משתמש / שם.
 * @param user — משתמש.
 * @returns string[] — הפלט בהתאם לחתימה.
 */
function getUserNameCandidates(
  user:
    ScheduleImportUser,
): string[] {
  return [
    user.scheduleName,
    user.displayName,
  ]
    .filter(
      (
        value,
      ): value is string =>
        Boolean(
          value?.trim(),
        ),
    )
    .map(
      normalizeImportNameStrict,
    );
}

/**
 * פעולה findUserById: איתור משתמש / מזהה.
 * @param users — משתמשים.
 * @param userId — מזהה משתמש.
 * @returns ScheduleImportUser | null — הפלט בהתאם לחתימה.
 */
function findUserById(
  users:
    ScheduleImportUser[],

  userId:
    string,
): ScheduleImportUser | null {
  return (
    users.find(
      (user) =>
        user.id ===
        userId,
    ) ??
    null
  );
}

/**
 * פעולה findUniqueUserMatch: איתור משתמש.
 * @param sourceName — מקור / שם.
 * @param users — משתמשים.
 * @param field — הנתון field בהקשר הפעולה.
 * @param normalizer — הנתון normalizer בהקשר הפעולה.
 * @returns ScheduleImportUser | null — הפלט בהתאם לחתימה.
 */
function findUniqueUserMatch(
  sourceName: string,

  users:
    ScheduleImportUser[],

  field:
    'scheduleName' |
    'displayName',

  normalizer:
    (
      value: string,
    ) => string,
): ScheduleImportUser | null {
  // normalizedSourceName — מקור / שם.
  const normalizedSourceName =
    normalizer(
      sourceName,
    );

  const matches =
    users.filter(
      (user) => {
        const candidate =
          user[field];

        return Boolean(
          candidate &&
          normalizer(
            candidate,
          ) ===
            normalizedSourceName,
        );
      },
    );

  return matches.length ===
      1
    ? matches[0]
    : null;
}

/**
 * פעולה findExactUserMatch: איתור משתמש.
 * @param sourceName — מקור / שם.
 * @param users — משתמשים.
 * @returns { user: ScheduleImportUser | null; matchSource: | 'schedule_name' | 'display_name' | 'unmatched'; } — הפלט בהתאם לחתימה.
 */
function findExactUserMatch(
  sourceName: string,

  users:
    ScheduleImportUser[],
): {
  // user — משתמש.
  user:
    ScheduleImportUser | null;

  // matchSource — מקור.
  matchSource:
    | 'schedule_name'
    | 'display_name'
    | 'unmatched';
} {
  // scheduleNameMatch — שיבוץ / שם.
  const scheduleNameMatch =
    findUniqueUserMatch(
      sourceName,
      users,
      'scheduleName',
      normalizeImportNameStrict,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר scheduleNameMatch.
  if (
    scheduleNameMatch
  ) {
    return {
      user:
        scheduleNameMatch,

      matchSource:
        'schedule_name',
    };
  }

  // displayNameMatch — שם תצוגה.
  const displayNameMatch =
    findUniqueUserMatch(
      sourceName,
      users,
      'displayName',
      normalizeImportNameStrict,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר displayNameMatch.
  if (
    displayNameMatch
  ) {
    return {
      user:
        displayNameMatch,

      matchSource:
        'display_name',
    };
  }

  return {
    user:
      null,

    matchSource:
      'unmatched',
  };
}

/**
 * פעולה findConservativeTypoMatch: איתור הנתון findConservativeTypoMatch בהקשר הפעולה.
 * @param sourceName — מקור / שם.
 * @param users — משתמשים.
 * @returns { user: ScheduleImportUser | null; matchSource: | 'schedule_name' | 'display_name' | 'unmatched'; } — הפלט בהתאם לחתימה.
 */
function findConservativeTypoMatch(
  sourceName: string,

  users:
    ScheduleImportUser[],
): {
  // user — משתמש.
  user:
    ScheduleImportUser | null;

  // matchSource — מקור.
  matchSource:
    | 'schedule_name'
    | 'display_name'
    | 'unmatched';
} {
  // scheduleNameMatch — שיבוץ / שם.
  const scheduleNameMatch =
    findUniqueUserMatch(
      sourceName,
      users,
      'scheduleName',
      normalizeImportNameTypoFallback,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר scheduleNameMatch.
  if (
    scheduleNameMatch
  ) {
    return {
      user:
        scheduleNameMatch,

      matchSource:
        'schedule_name',
    };
  }

  // displayNameMatch — שם תצוגה.
  const displayNameMatch =
    findUniqueUserMatch(
      sourceName,
      users,
      'displayName',
      normalizeImportNameTypoFallback,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר displayNameMatch.
  if (
    displayNameMatch
  ) {
    return {
      user:
        displayNameMatch,

      matchSource:
        'display_name',
    };
  }

  return {
    user:
      null,

    matchSource:
      'unmatched',
  };
}

/**
 * פעולה resolveImportName: קביעת ערך עבור ייבוא / שם.
 * @param sourceName — מקור / שם.
 * @param userType — משתמש.
 * @param users — משתמשים.
 * @param aliases — הנתון aliases בהקשר הפעולה.
 * @returns ScheduleImportResolvedName — הפלט בהתאם לחתימה.
 */
function resolveImportName(
  sourceName: string,

  userType:
    ScheduleImportUserType,

  users:
    ScheduleImportUser[],

  aliases:
    ScheduleImportNameAlias[],
): ScheduleImportResolvedName {
  // normalizedSourceName — מקור / שם.
  const normalizedSourceName =
    normalizeImportNameStrict(
      sourceName,
    );

  /*
   * 1. Exact user identity always wins.
   * This is what keeps "אולג מ" and "אולג ג" strictly separate.
   */
  const exactMatch =
    findExactUserMatch(
      sourceName,
      users,
    );

  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר exactMatch.user.
  if (
    exactMatch.user
  ) {
    return {
      sourceName,

      normalizedSourceName,

      userType,

      matchedUserId:
        exactMatch.user.id,

      matchedUser:
        exactMatch.user,

      matchSource:
        exactMatch.matchSource,
    };
  }

  /*
   * 2. Previously approved alias.
   * Support aliases saved by both the current strict normalizer and
   * the older final-letter normalizer so existing aliases keep working.
   */
  // legacyNormalizedSourceName — מקור / שם.
  const legacyNormalizedSourceName =
    normalizeImportNameTypoFallback(
      sourceName,
    );

  const alias =
    aliases.find(
      (currentAlias) =>
        currentAlias.userType ===
          userType &&
        (
          currentAlias
            .normalizedSourceName ===
            normalizedSourceName ||
          currentAlias
            .normalizedSourceName ===
            legacyNormalizedSourceName
        ),
    ) ??
    null;

  if (alias) {
    // aliasUser — משתמש.
    const aliasUser =
      findUserById(
        users,
        alias.userId,
      );

    // טיפול במקרה מיוחד ויציאה מוקדמת כאשר aliasUser.
    if (aliasUser) {
      return {
        sourceName,

        normalizedSourceName,

        userType,

        matchedUserId:
          aliasUser.id,

        matchedUser:
          aliasUser,

        matchSource:
          'alias',
      };
    }
  }

  /*
   * 3. Conservative typo fallback.
   * It is accepted only when exactly one user matches after final-letter
   * normalization. Ambiguous names remain unmatched and must be resolved
   * manually instead of guessing.
   */
  const typoMatch =
    findConservativeTypoMatch(
      sourceName,
      users,
    );

  return {
    sourceName,

    normalizedSourceName,

    userType,

    matchedUserId:
      typoMatch.user?.id ??
      null,

    matchedUser:
      typoMatch.user,

    matchSource:
      typoMatch.matchSource,
  };
}

/**
 * איגוד פעולות שיבוץ / ייבוא / שירות במחלקה ScheduleImportIdentityService.
 */
class ScheduleImportIdentityService {
  /**
   * פעולה אסינכרונית getImportUsers: שליפה או חישוב של ייבוא / משתמשים.
   * הפעולה פונה ל־RPC: get_schedule_import_users.
   * @returns Promise<ScheduleImportUsersData> — הפלט בהתאם לחתימה.
   */
  async getImportUsers():
    Promise<ScheduleImportUsersData> {
    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_schedule_import_users',
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeScheduleImportIdentityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data || typeof data !== 'object'.
    if (
      !data ||
      typeof data !==
        'object'
    ) {
      throw new Error(
        'התקבלה תשובה לא תקינה בעת טעינת משתמשי הייבוא.',
      );
    }

    // response — תוצאת הפעולה.
    const response =
      data as
        ScheduleImportUsersData;

    return {
      dispatchers:
        Array.isArray(
          response.dispatchers,
        )
          ? response.dispatchers
          : [],

      onCallDrivers:
        Array.isArray(
          response.onCallDrivers,
        )
          ? response.onCallDrivers
          : [],

      morningDrivers:
        Array.isArray(
          response.morningDrivers,
        )
          ? response.morningDrivers
          : [],

      aliases:
        Array.isArray(
          response.aliases,
        )
          ? response.aliases
          : [],
    };
  }

  /**
   * פעולה אסינכרונית saveNameAlias: שמירת שם.
   * הפעולה פונה ל־RPC: save_schedule_import_name_alias.
   * @param request — נתוני הבקשה.
   * @returns Promise<SaveScheduleImportNameAliasResponse> — הפלט בהתאם לחתימה.
   */
  async saveNameAlias(
    request:
      SaveScheduleImportNameAliasRequest,
  ): Promise<SaveScheduleImportNameAliasResponse> {
    // normalizedSourceName — מקור / שם.
    const normalizedSourceName =
      request.sourceName
        .trim();

    // normalizedUserId — מזהה משתמש.
    const normalizedUserId =
      request.userId
        .trim();

    // עצירת הפעולה עם שגיאה כאשר !normalizedSourceName.
    if (
      !normalizedSourceName
    ) {
      throw new Error(
        'שם המקור מהאקסל חסר.',
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !normalizedUserId.
    if (
      !normalizedUserId
    ) {
      throw new Error(
        'לא נבחר משתמש להתאמה.',
      );
    }

    // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'save_schedule_import_name_alias',
        {
          requested_source_name:
            normalizedSourceName,

          requested_user_id:
            normalizedUserId,

          requested_user_type:
            request.userType,
        },
      );

    // עצירת הפעולה עם שגיאה כאשר error.
    if (error) {
      throw normalizeScheduleImportIdentityError(
        error,
      );
    }

    // עצירת הפעולה עם שגיאה כאשר !data.
    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת שמירת התאמת השם.',
      );
    }

    return data as
      SaveScheduleImportNameAliasResponse;
  }

  /**
   * פעולה resolveDispatcherNames: קביעת ערך עבור מוקדנים.
   * @param sourceNames — מקור.
   * @param data — נתונים.
   * @returns ScheduleImportResolvedName[] — הפלט בהתאם לחתימה.
   */
  resolveDispatcherNames(
    sourceNames:
      readonly string[],

    data:
      ScheduleImportUsersData,
  ): ScheduleImportResolvedName[] {
    const uniqueNames =
      Array.from(
        new Set(
          sourceNames
            .map(
              (
                sourceName,
              ) =>
                sourceName
                  .trim(),
            )
            .filter(
              Boolean,
            ),
        ),
      );

    return uniqueNames.map(
      (sourceName) =>
        resolveImportName(
          sourceName,
          'dispatcher',
          data.dispatchers,
          data.aliases,
        ),
    );
  }

  /**
   * פעולה resolveOnCallDriverNames: קביעת ערך עבור כוננים.
   * @param sourceNames — מקור.
   * @param data — נתונים.
   * @returns ScheduleImportResolvedName[] — הפלט בהתאם לחתימה.
   */
  resolveOnCallDriverNames(
    sourceNames:
      readonly string[],

    data:
      ScheduleImportUsersData,
  ): ScheduleImportResolvedName[] {
    const uniqueNames =
      Array.from(
        new Set(
          sourceNames
            .map(
              (
                sourceName,
              ) =>
                sourceName
                  .trim(),
            )
            .filter(
              Boolean,
            ),
        ),
      );

    return uniqueNames.map(
      (sourceName) =>
        resolveImportName(
          sourceName,
          'on_call',
          data.onCallDrivers,
          data.aliases,
        ),
    );
  }


  /**
   * פעולה resolveMorningDriverNames: קביעת ערך עבור כונני בוקר.
   * @param sourceNames — מקור.
   * @param data — נתונים.
   * @returns ScheduleImportResolvedName[] — הפלט בהתאם לחתימה.
   */
  resolveMorningDriverNames(
    sourceNames:
      readonly string[],

    data:
      ScheduleImportUsersData,
  ): ScheduleImportResolvedName[] {
    const uniqueNames =
      Array.from(
        new Set(
          sourceNames
            .map(
              (
                sourceName,
              ) =>
                sourceName.trim(),
            )
            .filter(
              Boolean,
            ),
        ),
      );

    return uniqueNames.map(
      (
        sourceName,
      ) =>
        resolveImportName(
          sourceName,
          'morning_driver',
          data.morningDrivers,
          data.aliases,
        ),
    );
  }

  /**
   * פעולה getUserDisplayName: שליפה או חישוב של שם תצוגה.
   * @param user — משתמש.
   * @returns string — הפלט בהתאם לחתימה.
   */
  getUserDisplayName(
    user:
      ScheduleImportUser,
  ): string {
    return (
      user.scheduleName
        ?.trim() ||
      user.displayName
        .trim() ||
      user.email
    );
  }

  /**
   * פעולה getUserNameCandidates: שליפה או חישוב של משתמש / שם.
   * @param user — משתמש.
   * @returns string[] — הפלט בהתאם לחתימה.
   */
  getUserNameCandidates(
    user:
      ScheduleImportUser,
  ): string[] {
    return getUserNameCandidates(
      user,
    );
  }
}

// scheduleImportIdentityService — שיבוץ / ייבוא / שירות.
export const scheduleImportIdentityService =
  new ScheduleImportIdentityService();