/**
 * קובץ: src/utils/dynamicShiftDisplayName.ts
 * מטרה: פונקציות עזר לעיבוד וחישוב עבור שם תצוגה.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: isTechnicalShiftName, dynamicShiftDisplayName.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
// TECHNICAL_SHIFT_PATTERNS — משמרת.
const TECHNICAL_SHIFT_PATTERNS = [
  /^\d{8}-\d{4}$/i,
  /^\d{4}-\d{2}-\d{2}[-_T ]\d{2}:?\d{2}$/i,
  /^slot[-_:]/i,
  /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i,
];

/**
 * פעולה isTechnicalShiftName: בדיקת תנאי עבור משמרת / שם.
 * @param value — ערך.
 * @returns boolean — הפלט בהתאם לחתימה.
 */
export function isTechnicalShiftName(value?: string | null): boolean {
  // normalized — הנתון normalized בהקשר הפעולה.
  const normalized = value?.trim() ?? '';
  if (!normalized) return true;
  return TECHNICAL_SHIFT_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * פעולה dynamicShiftDisplayName: שם תצוגה.
 * @param value — ערך.
 * @param fallback — הנתון fallback בהקשר הפעולה.
 * @returns string — הפלט בהתאם לחתימה.
 */
export function dynamicShiftDisplayName(
  value?: string | null,
  fallback = 'משמרת',
): string {
  // normalized — הנתון normalized בהקשר הפעולה.
  const normalized = value?.trim() ?? '';
  return isTechnicalShiftName(normalized) ? fallback : normalized;
}
