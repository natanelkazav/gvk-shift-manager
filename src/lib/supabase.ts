import {
  createClient,
} from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env
    .VITE_SUPABASE_URL
    ?.trim();

const supabasePublishableKey =
  import.meta.env
    .VITE_SUPABASE_PUBLISHABLE_KEY
    ?.trim();

const rememberMeStorageKey =
  'gvk-auth-remember-me';

if (
  !supabaseUrl
) {
  throw new Error(
    'Missing VITE_SUPABASE_URL. Add it to the environment variables.',
  );
}

if (
  !supabasePublishableKey
) {
  throw new Error(
    'Missing VITE_SUPABASE_PUBLISHABLE_KEY. Add it to the environment variables.',
  );
}

function getRememberMePreference():
  boolean {
  const storedPreference =
    window.localStorage
      .getItem(
        rememberMeStorageKey,
      );

  /*
   * Backwards compatibility: before the checkbox existed,
   * Supabase persisted every session in localStorage.
   */
  if (
    storedPreference ===
      null
  ) {
    return true;
  }

  return storedPreference ===
    'true';
}

export function setRememberMePreference(
  rememberMe: boolean,
): void {
  window.localStorage
    .setItem(
      rememberMeStorageKey,
      String(rememberMe),
    );
}

const authStorage = {
  getItem(
    key: string,
  ): string | null {
    const preferredStorage =
      getRememberMePreference()
        ? window.localStorage
        : window.sessionStorage;

    const fallbackStorage =
      preferredStorage ===
        window.localStorage
        ? window.sessionStorage
        : window.localStorage;

    return (
      preferredStorage
        .getItem(key) ??
      fallbackStorage
        .getItem(key)
    );
  },

  setItem(
    key: string,
    value: string,
  ): void {
    const persistent =
      getRememberMePreference();

    const targetStorage =
      persistent
        ? window.localStorage
        : window.sessionStorage;

    const otherStorage =
      persistent
        ? window.sessionStorage
        : window.localStorage;

    targetStorage.setItem(
      key,
      value,
    );

    otherStorage.removeItem(
      key,
    );
  },

  removeItem(
    key: string,
  ): void {
    window.localStorage
      .removeItem(key);

    window.sessionStorage
      .removeItem(key);
  },
};

export const supabase =
  createClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      global: {
        headers: {
          apikey:
            supabasePublishableKey,
        },
      },

      auth: {
        persistSession:
          true,

        autoRefreshToken:
          true,

        detectSessionInUrl:
          true,

        storage:
          authStorage,
      },
    },
  );
