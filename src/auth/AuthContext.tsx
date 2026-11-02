/**
 * קובץ: src/auth/AuthContext.tsx
 * מטרה: הגדרת חוזה ההקשר המשמש לשיתוף מצב ההתחברות בין רכיבים.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AuthContextValue, AuthProviderProps, getErrorMessage, ensureProfileIsActive, AuthProvider, useAuth.
 * - קישור מאפיינים ומצב מקומי לתצוגה ולטיפול בפעולות המשתמש.
 */
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

/**
 * חוזה הנתונים AuthContextValue: אימות משתמשים / ערך.
 */
interface AuthContextValue
  extends AuthState {
  signIn: (
    credentials: SignInCredentials,
  ) => Promise<void>;

  signOut: () => Promise<void>;

  // refreshProfile — פרופיל.
  refreshProfile: () => Promise<void>;

  // refreshPermissions — הרשאות.
  refreshPermissions:
    () => Promise<void>;

  // hasPermission — הרשאות.
  hasPermission: (
    permission: PermissionKey,
  ) => boolean;

  // hasAnyPermission — הרשאות.
  hasAnyPermission: (
    permissions: PermissionKey[],
  ) => boolean;
  

  // hasAllPermissions — הרשאות.
  hasAllPermissions: (
    permissions: PermissionKey[],
  ) => boolean;

  // clearError — שגיאה.
  clearError: () => void;
}

// initialAuthState — אימות משתמשים / מצב.
const initialAuthState: AuthState = {
  session: null,
  user: null,
  profile: null,
  permissions: [],
  permissionsLoaded: false,
  isLoading: true,
  error: null,
};

// INACTIVE_USER_MESSAGE — משתמש / הודעה.
const INACTIVE_USER_MESSAGE =
  'המשתמש אינו פעיל. יש לפנות למנהל המערכת.';

// AuthContext — אימות משתמשים.
const AuthContext =
  createContext<
    AuthContextValue | undefined
  >(undefined);

/**
 * חוזה הנתונים AuthProviderProps: אימות משתמשים / מאפייני הרכיב.
 */
interface AuthProviderProps {
  // children — התוכן המקונן של הרכיב.
  children: ReactNode;
}

/**
 * פעולה getErrorMessage: שליפה או חישוב של הודעת שגיאה.
 * @param error — שגיאה.
 * @returns string — הפלט בהתאם לחתימה.
 */
function getErrorMessage(
  error: unknown,
): string {
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר error instanceof Error.
  if (error instanceof Error) {
    return error.message;
  }

  return 'אירעה שגיאה בלתי צפויה.';
}

/**
 * פעולה ensureProfileIsActive: הבטחת תנאי מקדים עבור האם הרשומה פעילה.
 * @param profile — פרופיל.
 * @returns void — הפלט בהתאם לחתימה.
 */
function ensureProfileIsActive(
  profile: UserProfile,
): void {
  // עצירת הפעולה עם שגיאה כאשר !profile.isActive.
  if (!profile.isActive) {
    throw new Error(
      INACTIVE_USER_MESSAGE,
    );
  }
}

/**
 * פעולה AuthProvider: אימות משתמשים.
 * פרמטר מפורק — שדות הקלט נגישים מקומית בשמות המוגדרים בחתימה.
 */
export function AuthProvider({
  children,
}: AuthProviderProps) {
  // מצב מקומי: authState — אימות משתמשים / מצב; setAuthState מעדכנת אותו ומפעילה רינדור לפי React.
  const [authState, setAuthState] =
    useState<AuthState>(
      initialAuthState,
    );

  // handleInactiveUser — משתמש.
  const handleInactiveUser =
    useCallback(
      async (): Promise<void> => {
        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
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
          permissionsLoaded: false,
          error:
            INACTIVE_USER_MESSAGE,
        });
      },
      [],
    );

  // loadAuthenticatedUserData — משתמש / נתונים.
  const loadAuthenticatedUserData =
    useCallback(
      async (
        session: Session,
      ): Promise<{
        // profile — פרופיל.
        profile: UserProfile;
        // permissions — הרשאות.
        permissions: PermissionKey[];
      }> => {
        // profile — פרופיל.
        const profile =
          await authService.getProfile(
            session.user.id,
          );

        ensureProfileIsActive(profile);

        // permissions — הרשאות.
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

  // applySession — סשן.
  const applySession = useCallback(
    async (
      session: Session | null,
      showLoading = true,
    ): Promise<void> => {
      // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !session.
      if (!session) {
        setAuthState(
          (currentState) => ({
            session: null,
            user: null,
            profile: null,
            permissions: [],
            isLoading: false,
            permissionsLoaded: false,
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

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
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
          permissionsLoaded: true,
          error: null,
        });
      } catch (error) {
        // errorMessage — הודעת שגיאה.
        const errorMessage =
          getErrorMessage(error);

        // טיפול במקרה מיוחד ויציאה מוקדמת כאשר errorMessage === INACTIVE_USER_MESSAGE.
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
          permissionsLoaded: true,
          error: errorMessage,
        });
      }
    },
    [
      handleInactiveUser,
      loadAuthenticatedUserData,
    ],
  );

  // תופעת לוואי לאחר רינדור בהתאם לתלויות [applySession].
  useEffect(() => {
    // isMounted — הנתון isMounted בהקשר הפעולה.
    let isMounted = true;

    /**
     * פעולה אסינכרונית initializeAuth: אימות משתמשים.
     * @returns Promise<void> — הפלט בהתאם לחתימה.
     */
    const initializeAuth =
      async (): Promise<void> => {
        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // session — סשן.
          const session =
            await authService
              .getCurrentSession();

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isMounted.
          if (!isMounted) {
            return;
          }

          await applySession(session);
        } catch (error) {
          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isMounted.
          if (!isMounted) {
            return;
          }

          setAuthState({
            session: null,
            user: null,
            profile: null,
            permissions: [],
            isLoading: false,
            permissionsLoaded: true,
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
              // טיפול במקרה מיוחד ויציאה מוקדמת כאשר !isMounted.
              if (!isMounted) {
                return;
              }

              // טיפול במקרה מיוחד ויציאה מוקדמת כאשר event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED'.
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

              // טיפול במקרה מיוחד ויציאה מוקדמת כאשר event === 'SIGNED_OUT'.
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
                    permissionsLoaded: false,
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
      /*
       * LoginPage manages its own submit/loading state.
       * Do not toggle the global auth loading flag here:
       * PublicOnlyRoute would replace LoginPage with LoadingScreen,
       * unmounting the form and clearing its local error message.
       */
      setAuthState(
        (currentState) => ({
          ...currentState,
          error: null,
        }),
      );

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        // session — סשן.
        const session =
          await authService.signIn({
            email:
              credentials.email.trim(),
            password:
              credentials.password,
            rememberMe:
              credentials.rememberMe,
          });

        // פירוק תוצאת הפעולה האסינכרונית לשדות הנתונים והשגיאה המוגדרים להלן.
        const {
          profile: loadedProfile,
          permissions,
        } =
          await loadAuthenticatedUserData(
            session,
          );

        // profile — פרופיל.
        let profile = loadedProfile;

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // loginTime — זמן.
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
          permissionsLoaded: true,
          error: null,
        });
      } catch (error) {
        // errorMessage — הודעת שגיאה.
        const errorMessage =
          getErrorMessage(error);

        // עצירת הפעולה עם שגיאה כאשר errorMessage === INACTIVE_USER_MESSAGE.
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
          permissionsLoaded: true,
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

      // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
      try {
        await authService.signOut();

        setAuthState({
          session: null,
          user: null,
          profile: null,
          permissions: [],
          isLoading: false,
          permissionsLoaded: false,
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

  // refreshProfile — פרופיל.
  const refreshProfile =
    useCallback(
      async (): Promise<void> => {
        // currentUser — המשתמש הנוכחי.
        const currentUser =
          authState.user;

        // עצירת הפעולה עם שגיאה כאשר !currentUser.
        if (!currentUser) {
          throw new Error(
            'לא נמצאה התחברות פעילה.',
          );
        }

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // profile — פרופיל.
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
          // errorMessage — הודעת שגיאה.
          const errorMessage =
            getErrorMessage(error);

          // טיפול במקרה מיוחד ויציאה מוקדמת כאשר errorMessage === INACTIVE_USER_MESSAGE.
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

  // refreshPermissions — הרשאות.
  const refreshPermissions =
    useCallback(
      async (): Promise<void> => {
        // עצירת הפעולה עם שגיאה כאשר !authState.user.
        if (!authState.user) {
          throw new Error(
            'לא נמצאה התחברות פעילה.',
          );
        }

        // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
        try {
          // permissions — הרשאות.
          const permissions =
            await permissionsService
              .getMyPermissions();

          setAuthState(
            (currentState) => ({
              ...currentState,
              permissions,
              permissionsLoaded: true,
              error: null,
            }),
          );
        } catch (error) {
          // errorMessage — הודעת שגיאה.
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

  // hasPermission — הרשאות.
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

  // hasAnyPermission — הרשאות.
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

  // hasAllPermissions — הרשאות.
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

  // clearError — שגיאה.
  const clearError =
    useCallback((): void => {
      setAuthState(
        (currentState) => ({
          ...currentState,
          error: null,
        }),
      );
    }, []);

  // ערך מחושב contextValue — ערך; נשמר בין רינדורים עד שינוי התלויות.
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

/**
 * פעולה useAuth: חיבור מצב או הקשר עבור אימות משתמשים.
 * @returns AuthContextValue — הפלט בהתאם לחתימה.
 */
export function useAuth():
  AuthContextValue {
  const context =
    useContext(AuthContext);

  // עצירת הפעולה עם שגיאה כאשר !context.
  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider.',
    );
  }

  return context;
}