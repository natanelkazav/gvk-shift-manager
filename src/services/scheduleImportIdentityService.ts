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

function normalizeImportName(
  value: string,
): string {
  return value
    .replace(
      /\u00a0/g,
      ' ',
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
      normalizeImportName,
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
  const normalizedSourceName =
    normalizeImportName(
      sourceName,
    );

  const scheduleNameMatch =
    users.find(
      (user) =>
        user.scheduleName &&
        normalizeImportName(
          user.scheduleName,
        ) ===
          normalizedSourceName,
    ) ??
    null;

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
    users.find(
      (user) =>
        normalizeImportName(
          user.displayName,
        ) ===
          normalizedSourceName,
    ) ??
    null;

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
    normalizeImportName(
      sourceName,
    );

  const alias =
    aliases.find(
      (currentAlias) =>
        currentAlias.userType ===
          userType &&
        currentAlias
          .normalizedSourceName ===
          normalizedSourceName,
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

  const exactMatch =
    findExactUserMatch(
      sourceName,
      users,
    );

  return {
    sourceName,

    normalizedSourceName,

    userType,

    matchedUserId:
      exactMatch.user?.id ??
      null,

    matchedUser:
      exactMatch.user,

    matchSource:
      exactMatch.matchSource,
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