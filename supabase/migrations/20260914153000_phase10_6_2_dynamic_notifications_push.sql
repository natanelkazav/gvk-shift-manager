-- קובץ: supabase/migrations/20260914153000_phase10_6_2_dynamic_notifications_push.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור דינמי / התראות / התראות Push.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.create_dynamic_schedule_publication_notification.
-- - מבני טבלאות: public.dynamic_schedule_reminder_deliveries.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- הגדרת מבנה הטבלה public.dynamic_schedule_reminder_deliveries והאילוצים המופיעים בהמשך.
create table if not exists public.dynamic_schedule_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.dynamic_schedule_published_assignments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('shift_start','daily_duty')),
  reminder_key text not null,
  notification_id uuid references public.notifications(id) on delete set null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, reminder_kind, reminder_key)
);

-- הגדרת האינדקס dynamic_schedule_reminder_deliveries_user_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists dynamic_schedule_reminder_deliveries_user_idx
  on public.dynamic_schedule_reminder_deliveries(user_id, created_at desc);

-- עדכון מבנה או הגדרות הטבלה public.dynamic_schedule_reminder_deliveries.
alter table public.dynamic_schedule_reminder_deliveries enable row level security;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on public.dynamic_schedule_reminder_deliveries from anon, authenticated;

-- פונקציית מסד public.create_dynamic_schedule_publication_notification: יצירת דינמי / שיבוץ / התראות.
create or replace function public.create_dynamic_schedule_publication_notification(
  requested_publication_id uuid
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
  -- target_publication — יעד.
  target_publication public.dynamic_schedule_publications%rowtype;
  -- target_job — יעד.
  target_job public.job_types%rowtype;
  -- notification_id — התראות / מזהה.
  notification_id uuid;
  -- recipient_count — כמות.
  recipient_count integer := 0;
  -- notification_title — התראות / כותרת.
  notification_title text;
  -- notification_body — התראות / תוכן.
  notification_body text;
  -- notification_url — התראות / כתובת יעד.
  notification_url text;
begin
  -- הסתעפות לפי התנאי current_user_id is null.
  if current_user_id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not authenticated';
  end if;

  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1 from public.profiles p
    where p.id = current_user_id and p.is_active = true
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'user not active';
  end if;

  select * into target_publication
  from public.dynamic_schedule_publications p
  where p.id = requested_publication_id;

  -- הסתעפות לפי התנאי target_publication.id is null.
  if target_publication.id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'publication not found';
  end if;

  -- הסתעפות לפי התנאי target_publication.status <> 'published'.
  if target_publication.status <> 'published' then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'schedule is not published';
  end if;

  -- הסתעפות לפי התנאי not public.has_dynamic_job_type_permission(.
  if not public.has_dynamic_job_type_permission(
    'schedule.publish',
    target_publication.job_type_id,
    current_user_id
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  select * into target_job
  from public.job_types jt
  where jt.id = target_publication.job_type_id
    and jt.is_active = true
    and jt.legacy_role is null;

  -- הסתעפות לפי התנאי target_job.id is null.
  if target_job.id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'dynamic job type not found';
  end if;

  notification_title := concat('פורסם לוח ', target_job.name);
  notification_body := concat(
    'פורסם לוח ', target_job.name,
    ' לחודש ', lpad(target_publication.month::text, 2, '0'), '/', target_publication.year,
    '. ניתן לצפות בשיבוץ המעודכן במערכת.'
  );
  notification_url := concat(
    '/my-shifts?jobTypeId=', target_job.id,
    '&year=', target_publication.year,
    '&month=', target_publication.month
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
    created_by,
    expires_at
  ) values (
    'schedule_published',
    'important',
    'dynamic_schedule_publish',
    notification_title,
    notification_body,
    notification_url,
    jsonb_build_object(
      'workflow', 'dynamic_schedule',
      'event', 'publication_published',
      'publicationId', target_publication.id,
      'jobTypeId', target_job.id,
      'jobTypeName', target_job.name,
      'year', target_publication.year,
      'month', target_publication.month
    ),
    current_user_id,
    now() + interval '90 days'
  )
  returning id into notification_id;

  -- הוספת רשומות ל־public.notification_recipients בהתאם לקלט ולתנאים להלן.
  insert into public.notification_recipients (
    notification_id,
    user_id
  )
  select distinct
    notification_id,
    m.user_id
  from public.job_type_memberships m
  join public.profiles p on p.id = m.user_id
  where m.job_type_id = target_job.id
    and p.is_active = true;

  get diagnostics recipient_count = row_count;

  -- הסתעפות לפי התנאי recipient_count = 0.
  if recipient_count = 0 then
    -- מחיקת הרשומות שנבחרו מתוך public.notifications בהתאם לקלט ולתנאים להלן.
    delete from public.notifications n where n.id = notification_id;
    -- הרכבת תוצאת הפעולה והחזרתה לקורא.
    return jsonb_build_object(
      'notificationId', null,
      'recipientCount', 0
    );
  end if;

  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(
    action, actor_user_id, entity_type, entity_id, summary, metadata
  ) values (
    'system_event',
    current_user_id,
    'dynamic_schedule_publication',
    target_publication.id,
    'נשלחה התראת פרסום לוח דינמי',
    jsonb_build_object(
      'job_type_id', target_job.id,
      'notification_id', notification_id,
      'recipient_count', recipient_count,
      'year', target_publication.year,
      'month', target_publication.month
    )
  );

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'notificationId', notification_id,
    'recipientCount', recipient_count
  );
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.create_dynamic_schedule_publication_notification(uuid) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.create_dynamic_schedule_publication_notification(uuid) to authenticated;

commit;
