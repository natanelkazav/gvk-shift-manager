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

interface ActiveUsersState {
  users:
    UserProfile[];

  isLoading:
    boolean;

  error:
    string | null;
}

interface UseActiveUsersResult {
  users:
    UserProfile[];

  isLoading:
    boolean;

  error:
    string | null;

  reload:
    () => Promise<void>;
}

const initialState:
  ActiveUsersState = {
    users:
      [],

    isLoading:
      true,

    error:
      null,
  };

function getErrorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'אירעה שגיאה בטעינת רשימת המשתמשים.';
}

export function useActiveUsers():
  UseActiveUsersResult {
  const [
    state,
    setState,
  ] =
    useState<ActiveUsersState>(
      initialState,
    );

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

        try {
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

  useEffect(
    () => {
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