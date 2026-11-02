-- קובץ: supabase/migrations/20260824195500_schedule_publication_notifications.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור שיבוץ / התראות.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.create_schedule_publication_notification.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- פונקציית מסד public.create_schedule_publication_notification: יצירת שיבוץ / התראות.
create or replace function public.create_schedule_publication_notification(
  requested_schedule_kind text,
  requested_period_id uuid
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = ''
as $function$
declare
  -- current_user_id — המשתמש הנוכחי הנוכחי.
  current_user_id uuid := auth.uid();
  -- current_permissions — הרשאות.
  current_permissions text[];
  -- required_permission — הרשאות.
  required_permission text;
  recipient_role text;
  -- notification_title — התראות / כותרת.
  notification_title text;
  -- notification_body — התראות / תוכן.
  notification_body text;
  -- notification_url — התראות / כתובת יעד.
  notification_url text;
  -- target_year — יעד / שנה.
  target_year integer;
  -- target_month — יעד / חודש.
  target_month integer;
  -- target_status — יעד / סטטוס.
  target_status text;
  -- notification_id — התראות / מזהה.
  notification_id uuid;
  -- recipient_count — כמות.
  recipient_count integer := 0;
begin
  -- הסתעפות לפי התנאי current_user_id is null.
  if current_user_id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not authenticated';
  end if;

  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1 from public.profiles
    where id = current_user_id and is_active = true
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'user not active';
  end if;

  current_permissions := coalesce(
    public.get_my_permissions(),
    array[]::text[]
  );

  case requested_schedule_kind
    when 'dispatcher' then
      required_permission := 'schedule.edit';
      recipient_role := 'dispatcher';
      notification_title := 'לוח המשמרות פורסם';

      select period.year, period.month, period.status::text
      into target_year, target_month, target_status
      from public.schedule_periods period
      where period.id = requested_period_id;

      notification_url := concat(
        '/schedule?year=', target_year,
        '&month=', target_month
      );

    when 'driver' then
      required_permission := 'driver_schedule.edit';
      recipient_role := 'on_call';
      notification_title := 'לוח הכוננויות פורסם';

      select period.year, period.month, period.status::text
      into target_year, target_month, target_status
      from public.driver_schedule_periods period
      where period.id = requested_period_id;

      notification_url := concat(
        '/driver-schedule?year=', target_year,
        '&month=', target_month
      );

    when 'morning_driver' then
      required_permission := 'morning_driver_schedule.edit';
      recipient_role := 'morning_driver';
      notification_title := 'לוח כוננויות הבוקר פורסם';

      select period.year, period.month, period.status::text
      into target_year, target_month, target_status
      from public.morning_driver_schedule_periods period
      where period.id = requested_period_id;

      notification_url := concat(
        '/morning-driver-schedule?year=', target_year,
        '&month=', target_month
      );

    else
      -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
      raise exception 'unsupported schedule kind';
  end case;

  -- הסתעפות לפי התנאי required_permission <> all(current_permissions).
  if required_permission <> all(current_permissions) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  -- הסתעפות לפי התנאי target_year is null or target_month is null.
  if target_year is null or target_month is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'schedule period not found';
  end if;

  -- הסתעפות לפי התנאי target_status <> 'published'.
  if target_status <> 'published' then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'schedule is not published';
  end if;

  notification_body := concat(
    'פורסם לוח לחודש ',
    lpad(target_month::text, 2, '0'),
    '/',
    target_year,
    '. ניתן לצפות בשיבוץ המעודכן במערכת.'
  );

  -- הוספת רשומות ל־public.notifications בהתאם לקלט ולתנאים להלן.
  insert into public.notifications (
    type,
    priority,
    source,
    title,
    body,
    url,
    data,
    created_by
  )
  values (
    'schedule_published',
    'important',
    concat(requested_schedule_kind, '_schedule_publish'),
    notification_title,
    notification_body,
    notification_url,
    jsonb_build_object(
      'scheduleKind', requested_schedule_kind,
      'periodId', requested_period_id,
      'year', target_year,
      'month', target_month
    ),
    current_user_id
  )
  returning id into notification_id;

  -- הוספת רשומות ל־public.notification_recipients בהתאם לקלט ולתנאים להלן.
  insert into public.notification_recipients (
    notification_id,
    user_id
  )
  select
    notification_id,
    profile.id
  from public.profiles profile
  where profile.is_active = true
    and profile.role::text = recipient_role;

  get diagnostics recipient_count = row_count;

  -- הסתעפות לפי התנאי recipient_count = 0.
  if recipient_count = 0 then
    -- מחיקת הרשומות שנבחרו מתוך public.notifications בהתאם לקלט ולתנאים להלן.
    delete from public.notifications
    where id = notification_id;

    -- הרכבת תוצאת הפעולה והחזרתה לקורא.
    return jsonb_build_object(
      'notificationId', null,
      'recipientCount', 0
    );
  end if;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'notificationId', notification_id,
    'recipientCount', recipient_count
  );
end;
$function$;
