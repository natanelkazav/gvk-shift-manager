# GVK Shift Manager — Regression Matrix

המסמך הזה הוא רשימת ה-regression הקבועה של הפרויקט. כל שינוי משמעותי צריך לעבור על האזור שהוא משנה ועל האזורים התלויים בו.

| מערכת | תרחיש קריטי | תוצאה צפויה | רמת בדיקה |
|---|---|---|---|
| Auth | משתמש פעיל מתחבר | Dashboard נטען והרשאות נטענות | E2E |
| Auth | משתמש מושבת מנסה להתחבר | גישה נחסמת | E2E |
| Permissions | משתמש ללא permission נכנס URL ישיר | נחסם גם בלי קשר ל-role | E2E |
| Users | השבתת משתמש | נשמרת היסטוריה; לא מועמד לעתיד | DB + E2E |
| Users | משתמש מושבת בסטטיסטיקה | מופיע באפור ובסוף, עם עבר היסטורי | E2E |
| Dispatcher availability | פתיחת תקופה | slots נכונים לחודש | DB + E2E |
| Dispatcher availability | מוקדן מגיש | submission עובר ל-submitted | DB + E2E |
| Dispatcher availability | לא הגיש בסגירה | החוסרים מושלמים לזמין + submission מוגש אוטומטית | DB |
| Dispatcher availability | פתיחה מחדש | ההגשה ניתנת לעריכה מחדש | DB + E2E |
| Dispatcher draft | יצירת טיוטה | מעבר למסך החודש המתאים | E2E |
| Dispatcher draft | רשימה כרונולוגית | תאריך ואז שעת התחלה | E2E |
| Dispatcher draft | החלפת מוקדן | טבלת איזון מתעדכנת אחרי שמירה | E2E |
| Dispatcher draft | מוקדן לא זמין | מוצג כלא זמין ברשימת הבחירה | E2E |
| Dispatcher draft | אי-הגשה אוטומטית | לא נספר כ״סימן זמין״ | DB + E2E |
| Dispatcher draft | intentionally unassigned | ניתן לשמור ולפרסם רק אם סומן במפורש | DB + E2E |
| Dispatcher publish | משמרת ריקה רגילה | פרסום נחסם | DB |
| Dispatcher publish | משמרת ריקה במכוון | פרסום מותר | DB |
| Dispatcher publish | פרסום | מוקדנים פעילים מקבלים notification/push | Integration |
| Published schedule | מעבר חודשים | החודש מה-URL נטען נכון | E2E |
| Published schedule | משתמש מושבת שהיה משובץ | השם נשמר בפרטי היום | E2E |
| Shift swaps | חד-כיווני | מחליף מאשר ואז מאשר סופי | DB + E2E |
| Shift swaps | דו-כיווני ימים שונים | final state תקין | DB + E2E |
| Shift swaps | דו-כיווני באותו יום 16-23 ↔ 23-06 | מותר אם אין חפיפה אחרת | DB |
| Shift swaps | חילוף יוצר חפיפה | נחסם | DB |
| Shift swaps | חילוף יוצר רצף נוסף | נחסם | DB |
| Drivers availability | פתיחה/שמירה/הגשה | נשמר לפי יום | DB + E2E |
| Drivers availability | חג/מועד | תג שם חג מופיע, ללא 200% | E2E |
| Drivers schedule | edit_any חודש נוכחי | ניתן לערוך כל כוננות | E2E |
| Drivers schedule | edit_any חודש הבא שפורסם | ניתן לערוך | E2E |
| Drivers schedule | חודש הבא לא פורסם | חסום | E2E |
| Drivers schedule | משתמש מושבת היסטורי | נשאר מוצג אך לא ניתן לבחור מחדש | DB + E2E |
| Morning availability | ערב חג | תג ערב חג/שם חג | E2E |
| Morning availability | חג מלא | אין slot של כוננות בוקר | DB |
| Morning schedule | Dashboard | כוננות נוכחית/באה, מקביל והתקדמות | E2E |
| Morning schedule | calendar edit_any | ניתן לערוך חודש נוכחי/הבא שפורסם | E2E |
| Morning schedule | משתמש מושבת היסטורי | נשאר מוצג | DB + E2E |
| Holidays | Hebcal import | calendar_special_days מתמלא | Integration |
| Holidays | לוח חודשי | שם המועד ליד מספר היום בשלושת סוגי הלוחות | E2E |
| Holidays | source sync | מקור החגים המרכזי עקבי | DB |
| Statistics | בחירת סוג משתמש | הרשימה מסוננת לפי role | E2E |
| Statistics | משתמש מושבת | מופיע בסוף ובאפור | E2E |
| Statistics | מוקדנים אילוצים | אי-הגשה מוצגת בנפרד מהשלמה אוטומטית | DB + E2E |
| Statistics | גרפים | גרפי עמודות אנכיים | Visual/E2E |
| Statistics | כוננים | שישי/שבת/חג לפי כונן | E2E |
| Payroll | מוקדן | hourly_rate | DB + E2E |
| Payroll | כונן | daily_duty_rate | DB + E2E |
| Payroll | כונן בוקר | morning_shift_rate × מספר משמרות | DB + E2E |
| Attendance | מוקדנים | placeholder עד TimeWatch, ללא נתונים מומצאים | E2E |
| Notifications | פרסום לוח | קהל לפי role הנכון | DB + Integration |
| Push | subscription refresh | לא חוסם פעולות עסקיות | Integration |
| Reminders | מוקדן | תזכורת לפני משמרת | Integration |
| Reminders | כונן | תזכורת יומית בשעה מוגדרת, כבוי כברירת מחדל | Integration |
| Reminders | כונן בוקר | כמו מוקדן | Integration |
| Audit | פעולות חדשות | נרשמות ביומן | DB + E2E |
| Archive | חודש מפורסם ישן | נשמר ונגיש | DB + E2E |
| Import | preview Excel | אינו משנה DB | Integration |
| Import | execute Excel | זהויות/שיבוצים מתעדכנים כצפוי | Integration |
| PWA | production build | service worker נבנה | Build |
| PWA | עדכון גרסה | אין cache של bundle ישן לאחר release | Manual/E2E |
| Server | כל RPC בשימוש | קיים ב-PostgREST deployed schema | Remote smoke |
| Server | כל Edge Function בשימוש | endpoint קיים ולא 404 | Remote smoke |
| Migrations | DB חדש מאפס | כל השרשרת רצה ללא תלות ידנית | CI DB reset |

## מקרי קיצון שחייבים לזכור

- משמרת שחוצה חצות.
- מעבר בין סוף חודש לתחילת חודש.
- שישי שהוא גם ערב חג.
- שבת/מוצאי חג.
- חג מלא ללא כוננות בוקר.
- משתמש שהושבת לאחר שכבר שובץ.
- משתמש שהופעל מחדש.
- טיוטה עם intentionally unassigned.
- שני משתמשים שמנסים לשנות את אותו שיבוץ סמוך בזמן.
- Push שנכשל אחרי שהפעולה העסקית כבר הצליחה.
- RPC שקיים מקומית אבל migration שלו לא עלתה לשרת.
- migration שעובדת ב-production רק בגלל אובייקט שנוצר ידנית בעבר.
