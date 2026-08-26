# GVK Shift Manager — Testing Guide

המטרה של שכבת הבדיקות היא למנוע מצב שבו תיקון של פיצ'ר אחד שובר RPC, הרשאה, מסך או תהליך אחר בלי שנבחין בכך לפני פריסה.

## 1. בדיקות שחייבות לרוץ לפני כל Git

```powershell
npm run test:quality
npm run test:smoke
```

`test:quality` מריץ lint, TypeScript, בדיקות חוזים של הפרויקט ו-build מלא. `test:smoke` היא בדיקה לקריאה בלבד מול Supabase המקושר: היא מוודאת שכל RPC שה-frontend משתמש בו באמת פרוס, ושכל Edge Function שהקוד קורא לה קיימת. היא אינה משנה נתונים.

## 2. בדיקות מסד נתונים מלאות

```powershell
npm run test:db:reset
```

בדיקה זו מאפסת Supabase **מקומי בלבד** מתוך כל שרשרת המיגרציות ומריצה pgTAP. היא תופסת בין היתר migration שתלויה בטבלה שלא נוצרה, RPC חסר, עמודה חסרה ו-schema drift.

נדרש Docker Desktop מקומי. אם אין Docker, GitHub Actions מריץ את הבדיקה הזו אוטומטית על runner עם Docker.

> לעולם לא מריצים `db reset` עם `--linked` או מול production.

## 3. E2E בדפדפן

הבדיקות נמצאות ב-`tests/e2e`. הן אינן מבצעות פעולות הרסניות; הן מתחברות עם חשבונות בדיקה ועוברות במסכים המותרים לכל role כדי לזהות קריסות ושגיאות Supabase גלויות.

התקנה חד-פעמית:

```powershell
npm install --no-save @playwright/test@1.55.0
npx playwright install chromium
```

הגדר משתני סביבה לחשבונות בדיקה נפרדים מהמשתמשים האמיתיים:

```text
GVK_TEST_BASE_URL=https://<staging-url>
GVK_TEST_MANAGER_EMAIL=...
GVK_TEST_MANAGER_PASSWORD=...
GVK_TEST_DISPATCHER_EMAIL=...
GVK_TEST_DISPATCHER_PASSWORD=...
GVK_TEST_DRIVER_EMAIL=...
GVK_TEST_DRIVER_PASSWORD=...
GVK_TEST_MORNING_DRIVER_EMAIL=...
GVK_TEST_MORNING_DRIVER_PASSWORD=...
```

ואז:

```powershell
npx playwright test
```

מומלץ להריץ E2E מול סביבת staging / Supabase test project ולא מול production.

## 4. ארבע רמות Gate

| Gate | מה נבדק | מתי |
|---|---|---|
| Fast | lint + typecheck + contracts | בכל שינוי |
| Build | Vite + PWA production build | לפני commit |
| DB | כל migrations + pgTAP | לפני merge / CI |
| E2E | login + roles + pages + workflows | לפני release משמעותי |

## 5. מה `test:contracts` תופס

- RPC שה-frontend קורא לו אבל אין לו הגדרה במיגרציות.
- Edge Function שה-frontend מפעיל אבל התיקייה שלה חסרה.
- role קריטי שנעלם מטיפוסי TypeScript.
- עמודות/schema קריטיים שנעלמו מהיסטוריית המיגרציות.
- timestamps כפולים של migrations.
- חזרה לשימוש ב-type הישן והלא קיים של כונני הבוקר.
- חוסר במערכת הבדיקות עצמה.

## 6. Production smoke

`npm run test:smoke` משתמש ב-URL וב-anon key בלבד וקורא את OpenAPI של PostgREST ואת כתובות Edge Functions. זו בדיקה read-only שמטרתה לזהות מצב שבו הקוד כבר קורא ל-RPC חדש אבל המיגרציה עדיין לא עלתה לשרת — בדיוק סוג התקלה שגרם בעבר ל-404 בסטטיסטיקות.

## 7. כלל עבודה חדש מומלץ

שינוי קוד לא נחשב מוכן עד ש:

1. `npm run test:quality` עבר.
2. אם יש migration — `npm run test:db:reset` עבר ב-CI או מקומית.
3. `npx supabase db push` עבר לסביבת היעד.
4. `npm run test:smoke` עבר לאחר ה-push.
5. בשינוי לזרימת משתמש — מריצים גם את תרחישי ה-E2E המתאימים.

כך אנחנו בודקים גם את הקוד לפני הפריסה וגם שהשרת בפועל תואם לקוד אחרי הפריסה.

## 8. ממצא חשוב מהקמת התשתית: migration drift

בבדיקה הראשונית נמצא שחלק מה-RPC-ים והטבלאות הקיימים בשרת אינם מוגדרים במלואם בתוך `supabase/migrations`. כלומר production מכיל היסטוריה שנוצרה גם מחוץ לשרשרת המיגרציות. זו בעיה בפני עצמה: מסד חדש מאפס עלול לא להיות זהה ל-production.

לכן `test:contracts` מציג כרגע RPC-ים כאלה כ-warning. אחרי שניצור baseline/squashed migration שמייצג את הסכמה הקיימת במלואה, יש להפעיל מצב strict:

```powershell
$env:GVK_STRICT_MIGRATION_CONTRACTS="1"
npm run test:contracts
```

היעד הוא להגיע למצב שבו `npx supabase db reset` ב-CI עובר תמיד. עד אז ה-Full Regression השבועי ישמש גם ככלי שמראה לנו בדיוק מה חסר ב-migration history.
