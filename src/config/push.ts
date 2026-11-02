/**
 * קובץ: src/config/push.ts
 * מטרה: ריכוז תצורת ברירת המחדל עבור התראות Push.
 * מטרות עיקריות:
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
// vapidPublicKey — מפתח.
const vapidPublicKey =
  import.meta.env
    .VITE_VAPID_PUBLIC_KEY
    ?.trim() ||
  null;

// pushConfig — התראות Push / תצורה.
export const pushConfig = {
  vapidPublicKey,
} as const;