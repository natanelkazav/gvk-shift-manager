-- קובץ: supabase/migrations/20260918104500_fix_role_change_open_availability_sync.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור אילוצים וזמינות.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.sync_open_dynamic_availability_after_role_version_change.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- Fix: role edits must never be blocked by the open-availability synchronization.
-- Rebuild the open period from the already-materialized effective role version,
-- then reset completed submissions and notify only those users.
-- פונקציית מסד public.sync_open_dynamic_availability_after_role_version_change: סנכרון פונקציית דיווח על שינוי.
create or replace function public.sync_open_dynamic_availability_after_role_version_change()
returns trigger
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  -- target_period — יעד / תקופה.
  target_period public.dynamic_availability_periods%rowtype;
  -- target_materialization — יעד / מימוש תצורת השיבוץ לחודש.
  target_materialization public.job_type_schedule_materializations%rowtype;
  -- affected_users — משתמשים.
  affected_users uuid[] := array[]::uuid[];
  -- affected_user — משתמש.
  affected_user uuid;
  -- created_notification_id — התראות / מזהה.
  created_notification_id uuid;
  -- target_year — יעד / שנה.
  target_year integer := extract(year from new.effective_month)::integer;
  -- target_month — יעד / חודש.
  target_month integer := extract(month from new.effective_month)::integer;
  rebuilt_slots integer := 0;
  actor uuid := coalesce(auth.uid(), new.created_by);
begin
  select ap.* into target_period
  from public.dynamic_availability_periods ap
  where ap.job_type_id=new.job_type_id
    and ap.year=target_year
    and ap.month=target_month
    and ap.status='open'
  limit 1;

  -- הסתעפות לפי התנאי target_period.id is null.
  if target_period.id is null then
    return new;
  end if;

  -- The preceding materialization trigger has already rebuilt this exact
  -- effective version. Read that canonical snapshot instead of guessing paths
  -- inside the configuration-version JSON.
  select m.* into target_materialization
  from public.job_type_schedule_materializations m
  where m.job_type_id=new.job_type_id
    and m.effective_month=new.effective_month
  limit 1;

  -- הסתעפות לפי התנאי target_materialization.id is null.
  if target_materialization.id is null then
    raise warning 'availability sync skipped: materialization missing for job type %, month %',
      new.job_type_id,new.effective_month;
    return new;
  end if;

  select coalesce(array_agg(s.user_id),array[]::uuid[])
    into affected_users
  from public.dynamic_availability_submissions s
  where s.period_id=target_period.id
    and s.status in ('submitted','reopened');

  -- Existing answers are structurally tied to the old slot ids. Slot deletion
  -- cascades availability entries and draft candidates that reference them;
  -- the canonical role materializer then creates the new form structure.
  -- מחיקת הרשומות שנבחרו מתוך public.dynamic_availability_slots בהתאם לקלט ולתנאים להלן.
  delete from public.dynamic_availability_slots
  where period_id=target_period.id;

  rebuilt_slots := public.materialize_dynamic_availability_period_slots(target_period.id);

  -- עדכון רשומות ב־public.dynamic_availability_periods בהתאם לקלט ולתנאים להלן.
  update public.dynamic_availability_periods ap
  set config_snapshot=coalesce(
        target_materialization.source_snapshot->'availabilityConfig',
        ap.config_snapshot,
        '{}'::jsonb
      ),
      updated_at=now()
  where ap.id=target_period.id;

  -- עדכון רשומות ב־public.dynamic_availability_submissions בהתאם לקלט ולתנאים להלן.
  update public.dynamic_availability_submissions s
  set status='draft',submitted_at=null,updated_at=now()
  where s.period_id=target_period.id
    and s.user_id=any(affected_users);

  foreach affected_user in array affected_users loop
    begin
      -- הוספת רשומות ל־public.notifications בהתאם לקלט ולתנאים להלן.
      insert into public.notifications(
        type,priority,source,title,body,url,data,created_by,expires_at
      ) values (
        'system','important','dynamic_availability',
        'תקופת האילוצים עודכנה',
        concat(
          coalesce(new.snapshot->>'name','התפקיד'),
          ' · מבנה המשמרות לחודש ',lpad(target_month::text,2,'0'),'/',target_year,
          ' השתנה. ההגשה הקודמת הוחזרה לטיוטה ויש למלא ולאשר את האילוצים מחדש.'
        ),
        '/my-availability',
        jsonb_build_object(
          'workflow','dynamic_availability',
          'event','role_definition_changed',
          'jobTypeId',new.job_type_id,
          'periodId',target_period.id,
          'year',target_year,
          'month',target_month,
          'recipientUserId',affected_user,
          'pushPending',true
        ),
        actor,
        now()+interval '90 days'
      ) returning id into created_notification_id;

      -- הוספת רשומות ל־public.notification_recipients בהתאם לקלט ולתנאים להלן.
      insert into public.notification_recipients(notification_id,user_id)
      values(created_notification_id,affected_user)
      on conflict do nothing;
    exception when others then
      -- A notification delivery problem must not prevent an administrator from
      -- saving the role or corrupt the freshly rebuilt availability period.
      raise warning 'availability sync notification failed for user %: %',affected_user,sqlerrm;
    end;
  end loop;

  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values(
    'system_event',actor,'dynamic_availability_period',target_period.id,
    'תקופת אילוצים עודכנה בעקבות שינוי מבנה תפקיד',
    jsonb_build_object(
      'job_type_id',new.job_type_id,
      'effective_month',new.effective_month,
      'rebuilt_slots',rebuilt_slots,
      'reset_submissions',coalesce(array_length(affected_users,1),0)
    )
  );

  return new;
exception when others then
  -- The role configuration is the source of truth. Never make role editing
  -- impossible because a secondary open-period synchronization encountered
  -- legacy/inconsistent period data. Record a DB warning and allow the save;
  -- a subsequent save will retry after the data issue is corrected.
  raise warning 'open availability sync failed for job type %, month %: %',
    new.job_type_id,new.effective_month,sqlerrm;
  return new;
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.sync_open_dynamic_availability_after_role_version_change() from public;

drop trigger if exists z_sync_open_dynamic_availability_after_role_version_change
  on public.job_type_configuration_versions;
create trigger z_sync_open_dynamic_availability_after_role_version_change
after insert or update of snapshot,effective_month
on public.job_type_configuration_versions
for each row execute function public.sync_open_dynamic_availability_after_role_version_change();

commit;
