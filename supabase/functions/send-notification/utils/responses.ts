/**
 * קובץ: supabase/functions/send-notification/utils/responses.ts
 * מטרה: בניית תגובות HTTP וכותרות CORS משותפות לפעולות השרת.
 * מטרות עיקריות:
 * - ממשקים ופעולות מרכזיים: createJsonResponse.
 * - ריכוז ההגדרות והלוגיקה המפורטות בהמשך הקובץ.
 */
// corsHeaders — הנתון corsHeaders בהקשר הפעולה.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',

  'Access-Control-Allow-Headers': [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
  ].join(', '),

  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

/**
 * פעולה createJsonResponse: יצירת תוצאת הפעולה.
 * @param body — תוכן.
 * @param status — סטטוס.
 * @returns Response — הפלט בהתאם לחתימה.
 */
export function createJsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,

      headers: {
        ...corsHeaders,

        'Content-Type':
          'application/json; charset=utf-8',
      },
    },
  );
}