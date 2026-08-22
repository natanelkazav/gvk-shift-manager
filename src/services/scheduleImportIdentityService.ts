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

interface SupabaseErrorShape {
  message?: unknown;

  details?: unknown;

  hint?: unknown;

  code?: unknown;
}

function normalizeScheduleImportIdentityError(
  error: unknown,
): Error {
  console.error(
    'Schedule import identity error:',
    error,
  );

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
    const databaseError =
      error as
        SupabaseErrorShape;

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
function normalizeImportNameTypoFallback(
  value: string,
): string {
  return normalizeImportNameStrict(
    value,
  ).replace(
    /[ךםןףץ]/g,
    (character) => {
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

function findExactUserMatch(
  sourceName: string,

  users:
    ScheduleImportUser[],
): {
  user:
    ScheduleImportUser | null;

  matchSource:
    | 'schedule_name'
    | 'display_name'
    | 'unmatched';
} {
  const scheduleNameMatch =
    findUniqueUserMatch(
      sourceName,
      users,
      'scheduleName',
      normalizeImportNameStrict,
    );

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

  const displayNameMatch =
    findUniqueUserMatch(
      sourceName,
      users,
      'displayName',
      normalizeImportNameStrict,
    );

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

function findConservativeTypoMatch(
  sourceName: string,

  users:
    ScheduleImportUser[],
): {
  user:
    ScheduleImportUser | null;

  matchSource:
    | 'schedule_name'
    | 'display_name'
    | 'unmatched';
} {
  const scheduleNameMatch =
    findUniqueUserMatch(
      sourceName,
      users,
      'scheduleName',
      normalizeImportNameTypoFallback,
    );

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

  const displayNameMatch =
    findUniqueUserMatch(
      sourceName,
      users,
      'displayName',
      normalizeImportNameTypoFallback,
    );

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

function resolveImportName(
  sourceName: string,

  userType:
    ScheduleImportUserType,

  users:
    ScheduleImportUser[],

  aliases:
    ScheduleImportNameAlias[],
): ScheduleImportResolvedName {
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
    const aliasUser =
      findUserById(
        users,
        alias.userId,
      );

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

class ScheduleImportIdentityService {
  async getImportUsers():
    Promise<ScheduleImportUsersData> {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        'get_schedule_import_users',
      );

    if (error) {
      throw normalizeScheduleImportIdentityError(
        error,
      );
    }

    if (
      !data ||
      typeof data !==
        'object'
    ) {
      throw new Error(
        'התקבלה תשובה לא תקינה בעת טעינת משתמשי הייבוא.',
      );
    }

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

  async saveNameAlias(
    request:
      SaveScheduleImportNameAliasRequest,
  ): Promise<SaveScheduleImportNameAliasResponse> {
    const normalizedSourceName =
      request.sourceName
        .trim();

    const normalizedUserId =
      request.userId
        .trim();

    if (
      !normalizedSourceName
    ) {
      throw new Error(
        'שם המקור מהאקסל חסר.',
      );
    }

    if (
      !normalizedUserId
    ) {
      throw new Error(
        'לא נבחר משתמש להתאמה.',
      );
    }

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

    if (error) {
      throw normalizeScheduleImportIdentityError(
        error,
      );
    }

    if (!data) {
      throw new Error(
        'לא התקבלה תשובה בעת שמירת התאמת השם.',
      );
    }

    return data as
      SaveScheduleImportNameAliasResponse;
  }

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

  getUserNameCandidates(
    user:
      ScheduleImportUser,
  ): string[] {
    return getUserNameCandidates(
      user,
    );
  }
}

export const scheduleImportIdentityService =
  new ScheduleImportIdentityService();