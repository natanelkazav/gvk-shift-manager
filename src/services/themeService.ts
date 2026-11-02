/**
 * קובץ: src/services/themeService.ts
 * מטרה: שמירה והחלה של בחירת ערכת הנושא בממשק.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: AppTheme, isAppTheme, readStoredTheme, applyTheme.
 * - ריכוז פעולות העיבוד והחישוב בהתאם לפונקציות להלן.
 */
/**
 * טיפוס AppTheme: הנתון AppTheme בהקשר הפעולה.
 */
export type AppTheme = 'light' | 'dark';

// STORAGE_KEY — מפתח.
const STORAGE_KEY = 'gvk-app-theme';
// DEFAULT_THEME — הנתון DEFAULT_THEME בהקשר הפעולה.
const DEFAULT_THEME: AppTheme = 'light';

/**
 * פעולה isAppTheme: בדיקת תנאי עבור הנתון isAppTheme בהקשר הפעולה.
 * @param value — ערך.
 * @returns value is AppTheme — הפלט בהתאם לחתימה.
 */
function isAppTheme(value: string | null): value is AppTheme {
  return value === 'light' || value === 'dark';
}

/**
 * פעולה readStoredTheme: הנתון readStoredTheme בהקשר הפעולה.
 * @returns AppTheme — הפלט בהתאם לחתימה.
 */
function readStoredTheme(): AppTheme {
  // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isAppTheme(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * פעולה applyTheme: החלת הנתון applyTheme בהקשר הפעולה.
 * @param theme — הנתון theme בהקשר הפעולה.
 */
function applyTheme(theme: AppTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

// themeService — שירות.
export const themeService = {
  /**
   * פעולה initialize: הנתון initialize בהקשר הפעולה.
   * @returns AppTheme — הפלט בהתאם לחתימה.
   */
  initialize(): AppTheme {
    const theme = readStoredTheme();
    applyTheme(theme);
    return theme;
  },

  /**
   * פעולה get: שליפה או חישוב של הנתון get בהקשר הפעולה.
   * @returns AppTheme — הפלט בהתאם לחתימה.
   */
  get(): AppTheme {
    return readStoredTheme();
  },

  /**
   * פעולה set: קביעת קבוצה ייחודית.
   * @param theme — הנתון theme בהקשר הפעולה.
   */
  set(theme: AppTheme) {
    // הפעלת הפעולות בתוך גבול טיפול בשגיאות; כשל מועבר לבלוק catch להלן.
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The visual preference can still be applied for the current session.
    }
    applyTheme(theme);
  },
};
