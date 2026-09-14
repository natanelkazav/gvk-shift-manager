Phase 10.6.9 - PWA stale asset recovery

מטרה:
למנוע מצב שבו index.html או sw.js ישנים נשמרים ב-cache אחרי deploy חדש,
ומפנים לקובץ JS hashed שכבר לא קיים בפריסה הנוכחית. במצב כזה Vercel
מחזיר index.html עבור כתובת ה-JS והדפדפן מציג:
Expected a JavaScript-or-Wasm module script but the server responded with MIME type text/html.

שינוי:
- index.html: no-store/no-cache
- sw.js: no-store/no-cache
- manifest.webmanifest: revalidate
- assets hashed: cache ארוך immutable

אין migration למסד.

בדיקה לאחר deploy:
1. פתח DevTools > Application > Service Workers ובצע Unregister לגרסה התקועה (פעם אחת).
2. Application > Storage > Clear site data.
3. בצע Hard Reload.
4. ודא שב-Network קבצי /assets/*.js חוזרים עם Content-Type: application/javascript ולא text/html.
