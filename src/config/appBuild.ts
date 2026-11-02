/**
 * קובץ: src/config/appBuild.ts
 * מטרה: הנגשת מזהה הבנייה ופרטי גרסת היישום לקוד הלקוח.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: getAppBuildLabel.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
// APP_VERSION — גרסה.
export const APP_VERSION = __APP_VERSION__;
// APP_BUILD_ID — מזהה.
export const APP_BUILD_ID = __APP_BUILD_ID__;

/**
 * פעולה getAppBuildLabel: שליפה או חישוב של תווית.
 * @returns string — הפלט בהתאם לחתימה.
 */
export function getAppBuildLabel(): string {
  return APP_BUILD_ID && APP_BUILD_ID !== APP_VERSION
    ? `${APP_VERSION} · ${APP_BUILD_ID}`
    : APP_VERSION;
}
