/**
 * קובץ: supabase/functions/send-notification/utils/errors.ts
 * מטרה: פונקציות עזר לעיבוד וחישוב עבור שגיאות.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: getRequiredEnvironmentVariable.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
/**
 * פעולה getRequiredEnvironmentVariable: שליפה או חישוב של הנתון getRequiredEnvironmentVariable בהקשר הפעולה.
 * @param name — שם.
 * @returns string — הפלט בהתאם לחתימה.
 */
export function getRequiredEnvironmentVariable(
  name: string,
): string {
  // value — ערך.
  const value =
    Deno.env
      .get(name)
      ?.trim();

  // עצירת הפעולה עם שגיאה כאשר !value.
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}