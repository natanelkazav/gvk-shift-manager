-- קובץ: supabase/migrations/20260928161000_fix_published_self_edit_can_view_others.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור האם צפייה מותרת.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.update_my_dynamic_published_assignment.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- Fix: update_my_dynamic_published_assignment referenced the removed local
-- variable can_view_others while writing the audit log. PostgreSQL therefore
-- raised 42703 after a valid published assignment update reached that block.
-- Keep the permission model unchanged and audit the permissions that this
-- function actually evaluates.

-- פונקציית מסד public.update_my_dynamic_published_assignment: עדכון דינמי / פורסם / הקצאה.
create or replace function public.update_my_dynamic_published_assignment(
  requested_publication_id uuid,
  requested_assignment_id uuid,
  requested_user_id uuid
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  -- current_user_id — המשתמש הנוכחי הנוכחי.
  current_user_id uuid := auth.uid();
  -- target_publication — יעד.
  target_publication public.dynamic_schedule_publications%rowtype;
  -- target_job — יעד.
  target_job public.job_types%rowtype;
  -- target_assignment — יעד / הקצאה.
  target_assignment public.dynamic_schedule_published_assignments%rowtype;
  -- current_month — חודש.
  current_month date := date_trunc('month', (now() at time zone 'Asia/Jerusalem')::date)::date;
  -- publication_month — חודש.
  publication_month date;
  -- change_mode — מצב פעולה.
  change_mode text;
  can_self_edit boolean := false;
  -- can_edit_all — האם עריכה מותרת.
  can_edit_all boolean := false;
  -- old_user_id — מזהה משתמש.
  old_user_id uuid;
begin
  -- הסתעפות לפי התנאי current_user_id is null.
  if current_user_id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not authenticated';
  end if;

  select * into target_publication
  from public.dynamic_schedule_publications
  where id = requested_publication_id
  for update;

  -- הסתעפות לפי התנאי target_publication.id is null.
  if target_publication.id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'publication not found';
  end if;

  -- הסתעפות לפי התנאי target_publication.status <> 'published'.
  if target_publication.status <> 'published' then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'published schedule is not editable';
  end if;

  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1
    from public.job_type_memberships m
    join public.profiles p on p.id = m.user_id
    where m.job_type_id = target_publication.job_type_id
      and m.user_id = current_user_id
      and p.is_active = true
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  select * into target_job
  from public.job_types
  where id = target_publication.job_type_id
    and legacy_role is null;

  -- הסתעפות לפי התנאי target_job.id is null.
  if target_job.id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'dynamic job type not found';
  end if;

  change_mode := coalesce(
    target_publication.config_snapshot #>> '{jobType,scheduleChangeMode}',
    target_job.scheduling_config #>> '{scheduleChangeMode}',
    'none'
  );

  -- הסתעפות לפי התנאי change_mode <> 'self_edit'.
  if change_mode <> 'self_edit' then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'self edit is not enabled for this role';
  end if;

  can_self_edit := public.has_dynamic_job_type_permission('schedule.self_edit', target_job.id, current_user_id);
  can_edit_all := public.has_dynamic_job_type_permission('schedule.edit_all', target_job.id, current_user_id);

  -- הסתעפות לפי התנאי not can_self_edit and not can_edit_all.
  if not can_self_edit and not can_edit_all then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  publication_month := make_date(target_publication.year, target_publication.month, 1);
  -- הסתעפות לפי התנאי publication_month not in (current_month, (current_month + interval '1 month')::date).
  if publication_month not in (current_month, (current_month + interval '1 month')::date) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'only current month or next published month can be edited';
  end if;

  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1
    from public.job_type_memberships m
    join public.profiles p on p.id = m.user_id
    where m.job_type_id = target_publication.job_type_id
      and m.user_id = requested_user_id
      and p.is_active = true
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'requested user is not an active member of this role';
  end if;

  select * into target_assignment
  from public.dynamic_schedule_published_assignments
  where id = requested_assignment_id
    and publication_id = target_publication.id
  for update;

  -- הסתעפות לפי התנאי target_assignment.id is null.
  if target_assignment.id is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'assignment not found';
  end if;

  -- Personal self-edit permits changing only the actor's current assignment.
  -- Editing another employee's assignment requires the explicit edit-all permission.
  -- הסתעפות לפי התנאי target_assignment.user_id <> current_user_id and not can_edit_all.
  if target_assignment.user_id <> current_user_id and not can_edit_all then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'editing another user''s assignment requires schedule.edit_all';
  end if;

  -- הסתעפות לפי התנאי target_assignment.user_id = requested_user_id.
  if target_assignment.user_id = requested_user_id then
    -- הרכבת תוצאת הפעולה והחזרתה לקורא.
    return jsonb_build_object('saved', true, 'changed', false, 'assignmentId', target_assignment.id);
  end if;

  -- הסתעפות לפי התנאי exists (.
  if exists (
    select 1
    from public.dynamic_schedule_published_assignments a
    where a.publication_id = target_publication.id
      and a.shift_date = target_assignment.shift_date
      and a.shift_code = target_assignment.shift_code
      and a.user_id = requested_user_id
      and a.id <> target_assignment.id
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'requested user is already assigned to this shift';
  end if;

  old_user_id := target_assignment.user_id;

  -- עדכון רשומות ב־public.dynamic_schedule_published_assignments בהתאם לקלט ולתנאים להלן.
  update public.dynamic_schedule_published_assignments
  set user_id = requested_user_id,
      user_edited_by = current_user_id,
      user_edited_at = now()
  where id = target_assignment.id;

  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(action, actor_user_id, entity_type, entity_id, summary, metadata)
  values(
    'system_event',
    current_user_id,
    'dynamic_schedule_publication',
    target_publication.id,
    case
      when old_user_id = current_user_id then 'שיבוץ אישי בלוח דינמי שונה על ידי העובד'
      else 'שיבוץ של עובד אחר בלוח דינמי שונה על ידי עובד מורשה'
    end,
    jsonb_build_object(
      'publication_id', target_publication.id,
      'job_type_id', target_publication.job_type_id,
      'assignment_id', target_assignment.id,
      'shift_date', target_assignment.shift_date,
      'shift_code', target_assignment.shift_code,
      'old_user_id', old_user_id,
      'new_user_id', requested_user_id,
      'can_self_edit', can_self_edit,
      'can_edit_all', can_edit_all
    )
  );

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'saved', true,
    'changed', true,
    'assignmentId', target_assignment.id,
    'oldUserId', old_user_id,
    'newUserId', requested_user_id
  );
end;
$function$;


-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.update_my_dynamic_published_assignment(uuid, uuid, uuid) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.update_my_dynamic_published_assignment(uuid, uuid, uuid) to authenticated;

commit;
