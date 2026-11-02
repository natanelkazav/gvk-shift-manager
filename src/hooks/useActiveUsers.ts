/**
 * קובץ: src/hooks/useActiveUsers.ts
 * מטרה: ניהול מצב ותופעות לוואי באמצעות React עבור פעיל / משתמשים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: ActiveUsersState, UseActiveUsersResult, getErrorMessage, useActiveUsers.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  usersService,
} from '../services/usersService';

import type {
  UserProfile,
} from '../types/auth';

/**
 * חוזה הנתונים ActiveUsersState: פעיל / משתמשים / מצב.
 */
interface ActiveUsersState {
  // users — משתמשים.
  users:
    UserProfile[];

  // isLoading — האם טעינה מתבצעת.
  isLoading:
    boolean;

  // error — שגיאה.
  error:
    string | null;
}

/**
 * חוזה הנתונים UseActiveUsersResult: פעיל / משתמשים / תוצאה.
 */
interface UseActiveUsersResult {
  // users — משתמשים.
  users:
    UserProfile[];

  // isLoading — האם טעינה מתבצעת.
  isLoading:
    boolean;

  // error — שגיאה.
  error:
    string | null;

  reload:
    () => Promise<void>;
}

// initialState — מצב.
const initialState:
  ActiveUsersState = {
    users:
      [],

    isLoading:
      true,

    error:
      null,
  };

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בטעינת רשימת המשתמשים.';
}

/**
 * פעולה useActiveUsers: חיבור מצב או הקשר עבור פעיל / משתמשים.
 * @returns UseActiveUsersResult — הפלט בהתאם לחתימה.
 */
export function useActiveUsers():
  UseActiveUsersResult {
  // מצב מקומי: state — מצב; setState מעדכנת אותו ומפעילה רינדור לפי React.
  const [
    state,
    setState,
  ] =
    useState<ActiveUsersState>(
      initialState,
    );

  // loadUsers — משתמשים.
  const loadUsers =
    useCallback(
      async (): Promise<void> => {
        setState(
          (
            currentState,
          ) => ({
            ...currentState,

            isLoading:
              true,

            error:
              null,
          }),
        );

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // users — משתמשים.
          const users =
            await usersService
              .getUsers();

          setState({
            users,

            isLoading:
              false,

            error:
              null,
          });
        } catch (
          error
        ) {
          setState({
            users:
              [],

            isLoading:
              false,

            error:
              getErrorMessage(
                error,
              ),
          });
        }
      },
      [],
    );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [ loadUsers, ].
  useEffect(
    () => {
      // timeoutId — משך המתנה / מזהה.
      const timeoutId =
        window.setTimeout(
          () => {
            void loadUsers();
          },
          0,
        );

      return () => {
        window.clearTimeout(
          timeoutId,
        );
      };
    },
    [
      loadUsers,
    ],
  );

  // ערך מחושב activeUsers — פעיל / משתמשים; נשמר בין רינדורים עד שינוי התלויות.
  const activeUsers =
    useMemo(
      () =>
        state.users.filter(
          (
            user,
          ) =>
            user.isActive,
        ),
      [
        state.users,
      ],
    );

  return {
    users:
      activeUsers,

    isLoading:
      state.isLoading,

    error:
      state.error,

    reload:
      loadUsers,
  };
}