/**
 * קובץ: src/lib/supabase.ts
 * מטרה: יצירת לקוח Supabase ושילוב אחסון הסשן עם העדפת זכירת ההתחברות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: getRememberMePreference, setRememberMePreference.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
import {
  createClient,
} from '@supabase/supabase-js';

// supabaseUrl — כתובת יעד.
const supabaseUrl =
  import.meta.env
    .VITE_SUPABASE_URL
    ?.trim();

// supabasePublishableKey — מפתח.
const supabasePublishableKey =
  import.meta.env
    .VITE_SUPABASE_PUBLISHABLE_KEY
    ?.trim();

// rememberMeStorageKey — מפתח.
const rememberMeStorageKey =
  'gvk-auth-remember-me';

// עצירת הפעולה עם שגיאה כאשר !supabaseUrl.
if (
  !supabaseUrl
) {
  throw new Error(
    'Missing VITE_SUPABASE_URL. Add it to the environment variables.',
  );
}

// עצירת הפעולה עם שגיאה כאשר !supabasePublishableKey.
if (
  !supabasePublishableKey
) {
  throw new Error(
    'Missing VITE_SUPABASE_PUBLISHABLE_KEY. Add it to the environment variables.',
  );
}

/**
 * פעולה getRememberMePreference: שליפה או חישוב של הנתון getRememberMePreference בהקשר הפעולה.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
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
  // טיפול במקרה מיוחד ויציאה מוקדמת כאשר storedPreference === null.
  if (
    storedPreference ===
      null
  ) {
    return true;
  }

  return storedPreference ===
    'true';
}

/**
 * פעולה setRememberMePreference: קביעת קבוצה ייחודית.
 * @param rememberMe — הנתון rememberMe בהקשר הפעולה.
 * @returns void — הפלט בהתאם לחתימה.
 */
export function setRememberMePreference(
  rememberMe: boolean,
): void {
  window.localStorage
    .setItem(
      rememberMeStorageKey,
      String(rememberMe),
    );
}

// authStorage — אימות משתמשים.
const authStorage = {
  /**
   * פעולה getItem: שליפה או חישוב של פריט.
   * @param key — מפתח.
   * @returns string | null — הפלט בהתאם לחתימה.
   */
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

  /**
   * פעולה setItem: קביעת קבוצה ייחודית / פריט.
   * @param key — מפתח.
   * @param value — ערך.
   * @returns void — הפלט בהתאם לחתימה.
   */
  setItem(
    key: string,
    value: string,
  ): void {
    const persistent =
      getRememberMePreference();

    // targetStorage — יעד.
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

  /**
   * פעולה removeItem: הסרת פריט.
   * @param key — מפתח.
   * @returns void — הפלט בהתאם לחתימה.
   */
  removeItem(
    key: string,
  ): void {
    window.localStorage
      .removeItem(key);

    window.sessionStorage
      .removeItem(key);
  },
};

// supabase — הנתון supabase בהקשר הפעולה.
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
