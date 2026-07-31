import type {
  Session,
} from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import { authService } from '../services/authService';
import { permissionsService } from '../services/permissionsService';
import type {
  AuthState,
  PermissionKey,
  SignInCredentials,
  UserProfile,
} from '../types/auth';

interface AuthContextValue
  extends AuthState {
  signIn: (
    credentials: SignInCredentials,
  ) => Promise<void>;

  signOut: () => Promise<void>;

  refreshProfile: () => Promise<void>;

  refreshPermissions:
    () => Promise<void>;

  hasPermission: (
    permission: PermissionKey,
  ) => boolean;

  hasAnyPermission: (
    permissions: PermissionKey[],
  ) => boolean;

  hasAllPermissions: (
    permissions: PermissionKey[],
  ) => boolean;

  clearError: () => void;
}

const initialAuthState: AuthState = {
  session: null,
  user: null,
  profile: null,
  permissions: [],
  isLoading: true,
  error: null,
};

const INACTIVE_USER_MESSAGE =
  'המשתמש אינו פעיל. יש לפנות למנהל המערכת.';

const AuthContext =
  createContext<
    AuthContextValue | undefined
  >(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה.';
}

function ensureProfileIsActive(
  profile: UserProfile,
): void {
  if (!profile.isActive) {
    throw new Error(
      INACTIVE_USER_MESSAGE,
    );
  }
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [authState, setAuthState] =
    useState<AuthState>(
      initialAuthState,
    );

  const handleInactiveUser =
    useCallback(
      async (): Promise<void> => {
        try {
          await authService.signOut();
        } catch (error) {
          console.error(
            'INACTIVE USER SIGN OUT ERROR:',
            error,
          );
        }

        setAuthState({
          session: null,
          user: null,
          profile: null,
          permissions: [],
          isLoading: false,
          error:
            INACTIVE_USER_MESSAGE,
        });
      },
      [],
    );

  const loadAuthenticatedUserData =
    useCallback(
      async (
        session: Session,
      ): Promise<{
        profile: UserProfile;
        permissions: PermissionKey[];
      }> => {
        const profile =
          await authService.getProfile(
            session.user.id,
          );

        ensureProfileIsActive(profile);

        const permissions =
          await permissionsService
            .getMyPermissions();

        return {
          profile,
          permissions,
        };
      },
      [],
    );

  const applySession = useCallback(
    async (
      session: Session | null,
      showLoading = true,
    ): Promise<void> => {
      if (!session) {
        setAuthState(
          (currentState) => ({
            session: null,
            user: null,
            profile: null,
            permissions: [],
            isLoading: false,
            error:
              currentState.error,
          }),
        );

        return;
      }

      if (showLoading) {
        setAuthState(
          (currentState) => ({
            ...currentState,
            session,
            user: session.user,
            isLoading: true,
            error: null,
          }),
        );
      }

      try {
        const {
          profile,
          permissions,
        } =
          await loadAuthenticatedUserData(
            session,
          );

        setAuthState({
          session,
          user: session.user,
          profile,
          permissions,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        const errorMessage =
          getErrorMessage(error);

        if (
          errorMessage ===
          INACTIVE_USER_MESSAGE
        ) {
          await handleInactiveUser();
          return;
        }

        setAuthState({
          session: null,
          user: null,
          profile: null,
          permissions: [],
          isLoading: false,
          error: errorMessage,
        });
      }
    },
    [
      handleInactiveUser,
      loadAuthenticatedUserData,
    ],
  );

  useEffect(() => {
    let isMounted = true;

    const initializeAuth =
      async (): Promise<void> => {
        try {
          const session =
            await authService
              .getCurrentSession();

          if (!isMounted) {
            return;
          }

          await applySession(session);
        } catch (error) {
          if (!isMounted) {
            return;
          }

          setAuthState({
            session: null,
            user: null,
            profile: null,
            permissions: [],
            isLoading: false,
            error:
              getErrorMessage(error),
          });
        }
      };

    void initializeAuth();

    const {
      data: { subscription },
    } =
      supabase.auth
        .onAuthStateChange(
          (event, session) => {
            window.setTimeout(() => {
              if (!isMounted) {
                return;
              }

              if (
                event ===
                  'USER_UPDATED' ||
                event ===
                  'TOKEN_REFRESHED'
              ) {
                setAuthState(
                  (currentState) => ({
                    ...currentState,
                    session:
                      session ??
                      currentState.session,
                    user:
                      session?.user ??
                      currentState.user,
                  }),
                );

                return;
              }

              if (
                event === 'SIGNED_OUT'
              ) {
                setAuthState(
                  (currentState) => ({
                    session: null,
                    user: null,
                    profile: null,
                    permissions: [],
                    isLoading: false,
                    error:
                      currentState.error,
                  }),
                );

                return;
              }

              void applySession(
                session,
                false,
              );
            }, 0);
          },
        );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = useCallback(
    async (
      credentials:
        SignInCredentials,
    ): Promise<void> => {
      setAuthState(
        (currentState) => ({
          ...currentState,
          isLoading: true,
          error: null,
        }),
      );

      try {
        const session =
          await authService.signIn({
            email:
              credentials.email.trim(),
            password:
              credentials.password,
          });

        const {
          profile: loadedProfile,
          permissions,
        } =
          await loadAuthenticatedUserData(
            session,
          );

        let profile = loadedProfile;

        try {
          const loginTime =
            await authService
              .recordLogin();

          profile = {
            ...loadedProfile,
            lastLoginAt: loginTime,
            updatedAt: loginTime,
          };
        } catch (
          recordLoginError
        ) {
          console.error(
            'LOGIN TIME UPDATE ERROR:',
            recordLoginError,
          );
        }

        setAuthState({
          session,
          user: session.user,
          profile,
          permissions,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        const errorMessage =
          getErrorMessage(error);

        if (
          errorMessage ===
          INACTIVE_USER_MESSAGE
        ) {
          await handleInactiveUser();
          throw error;
        }

        setAuthState({
          session: null,
          user: null,
          profile: null,
          permissions: [],
          isLoading: false,
          error: errorMessage,
        });

        throw error;
      }
    },
    [
      handleInactiveUser,
      loadAuthenticatedUserData,
    ],
  );

  const signOut = useCallback(
    async (): Promise<void> => {
      setAuthState(
        (currentState) => ({
          ...currentState,
          isLoading: true,
          error: null,
        }),
      );

      try {
        await authService.signOut();

        setAuthState({
          session: null,
          user: null,
          profile: null,
          permissions: [],
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setAuthState(
          (currentState) => ({
            ...currentState,
            isLoading: false,
            error:
              getErrorMessage(error),
          }),
        );

        throw error;
      }
    },
    [],
  );

  const refreshProfile =
    useCallback(
      async (): Promise<void> => {
        const currentUser =
          authState.user;

        if (!currentUser) {
          throw new Error(
            'לא נמצאה התחברות פעילה.',
          );
        }

        try {
          const profile =
            await authService.getProfile(
              currentUser.id,
            );

          ensureProfileIsActive(
            profile,
          );

          setAuthState(
            (currentState) => ({
              ...currentState,
              profile,
              isLoading: false,
              error: null,
            }),
          );
        } catch (error) {
          const errorMessage =
            getErrorMessage(error);

          if (
            errorMessage ===
            INACTIVE_USER_MESSAGE
          ) {
            await handleInactiveUser();
            return;
          }

          setAuthState(
            (currentState) => ({
              ...currentState,
              isLoading: false,
              error: errorMessage,
            }),
          );

          throw error;
        }
      },
      [
        authState.user,
        handleInactiveUser,
      ],
    );

  const refreshPermissions =
    useCallback(
      async (): Promise<void> => {
        if (!authState.user) {
          throw new Error(
            'לא נמצאה התחברות פעילה.',
          );
        }

        try {
          const permissions =
            await permissionsService
              .getMyPermissions();

          setAuthState(
            (currentState) => ({
              ...currentState,
              permissions,
              error: null,
            }),
          );
        } catch (error) {
          const errorMessage =
            getErrorMessage(error);

          setAuthState(
            (currentState) => ({
              ...currentState,
              error: errorMessage,
            }),
          );

          throw error;
        }
      },
      [authState.user],
    );

  const hasPermission =
    useCallback(
      (
        permission: PermissionKey,
      ): boolean =>
        authState.permissions.includes(
          permission,
        ),
      [authState.permissions],
    );

  const hasAnyPermission =
    useCallback(
      (
        permissions:
          PermissionKey[],
      ): boolean =>
        permissions.some(
          (permission) =>
            authState.permissions
              .includes(permission),
        ),
      [authState.permissions],
    );

  const hasAllPermissions =
    useCallback(
      (
        permissions:
          PermissionKey[],
      ): boolean =>
        permissions.every(
          (permission) =>
            authState.permissions
              .includes(permission),
        ),
      [authState.permissions],
    );

  const clearError =
    useCallback((): void => {
      setAuthState(
        (currentState) => ({
          ...currentState,
          error: null,
        }),
      );
    }, []);

  const contextValue =
    useMemo<AuthContextValue>(
      () => ({
        ...authState,
        signIn,
        signOut,
        refreshProfile,
        refreshPermissions,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        clearError,
      }),
      [
        authState,
        signIn,
        signOut,
        refreshProfile,
        refreshPermissions,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        clearError,
      ],
    );

  return (
    <AuthContext.Provider
      value={contextValue}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth():
  AuthContextValue {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider.',
    );
  }

  return context;
}