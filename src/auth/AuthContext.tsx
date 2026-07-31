import type { Session } from '@supabase/supabase-js';
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
import type {
  AuthState,
  SignInCredentials,
} from '../types/auth';

interface AuthContextValue extends AuthState {
  signIn: (
    credentials: SignInCredentials,
  ) => Promise<void>;

  signOut: () => Promise<void>;

  refreshProfile: () => Promise<void>;

  clearError: () => void;
}

const initialAuthState: AuthState = {
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  error: null,
};

const AuthContext =
  createContext<AuthContextValue | undefined>(
    undefined,
  );

interface AuthProviderProps {
  children: ReactNode;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה.';
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [authState, setAuthState] =
    useState<AuthState>(initialAuthState);

  const applySession = useCallback(
    async (
      session: Session | null,
      showLoading = true,
    ): Promise<void> => {
      if (!session) {
        setAuthState({
          session: null,
          user: null,
          profile: null,
          isLoading: false,
          error: null,
        });

        return;
      }

      if (showLoading) {
        setAuthState((currentState) => ({
          ...currentState,
          session,
          user: session.user,
          isLoading: true,
          error: null,
        }));
      }

      try {
        const profile =
          await authService.getProfile(
            session.user.id,
          );

        if (!profile) {
          throw new Error(
            'לא נמצא פרופיל משתמש מתאים במערכת.',
          );
        }

        setAuthState({
          session,
          user: session.user,
          profile,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setAuthState({
          session: null,
          user: null,
          profile: null,
          isLoading: false,
          error: getErrorMessage(error),
        });
      }
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    const initializeAuth =
      async (): Promise<void> => {
        try {
          const session =
            await authService.getCurrentSession();

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
            isLoading: false,
            error: getErrorMessage(error),
          });
        }
      };

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        window.setTimeout(() => {
          if (isMounted) {
            void applySession(
              session,
              false,
            );
          }
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
      credentials: SignInCredentials,
    ): Promise<void> => {
      setAuthState((currentState) => ({
        ...currentState,
        isLoading: true,
        error: null,
      }));

      try {
        const session =
          await authService.signIn({
            email: credentials.email.trim(),
            password: credentials.password,
          });

        const profile =
          await authService.getProfile(
            session.user.id,
          );

        if (!profile) {
          throw new Error(
            'ההתחברות הצליחה, אך לא נמצא פרופיל משתמש במערכת.',
          );
        }

        setAuthState({
          session,
          user: session.user,
          profile,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        const errorMessage =
          getErrorMessage(error);

        setAuthState({
          session: null,
          user: null,
          profile: null,
          isLoading: false,
          error: errorMessage,
        });

        throw error;
      }
    },
    [],
  );

  const signOut = useCallback(
    async (): Promise<void> => {
      setAuthState((currentState) => ({
        ...currentState,
        isLoading: true,
        error: null,
      }));

      try {
        await authService.signOut();

        setAuthState({
          session: null,
          user: null,
          profile: null,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setAuthState((currentState) => ({
          ...currentState,
          isLoading: false,
          error: getErrorMessage(error),
        }));

        throw error;
      }
    },
    [],
  );

  const refreshProfile =
    useCallback(async (): Promise<void> => {
      if (!authState.user) {
        return;
      }

      try {
        const profile =
          await authService.getProfile(
            authState.user.id,
          );

        if (!profile) {
          throw new Error(
            'לא נמצא פרופיל משתמש מתאים במערכת.',
          );
        }

        setAuthState((currentState) => ({
          ...currentState,
          profile,
          error: null,
        }));
      } catch (error) {
        setAuthState((currentState) => ({
          ...currentState,
          error: getErrorMessage(error),
        }));

        throw error;
      }
    }, [authState.user]);

  const clearError = useCallback(() => {
    setAuthState((currentState) => ({
      ...currentState,
      error: null,
    }));
  }, []);

  const contextValue =
    useMemo<AuthContextValue>(
      () => ({
        ...authState,
        signIn,
        signOut,
        refreshProfile,
        clearError,
      }),
      [
        authState,
        signIn,
        signOut,
        refreshProfile,
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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider.',
    );
  }

  return context;
}