-- קובץ: supabase/migrations/20261018103000_draft_member_preferences_statistics.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור טיוטה / סטטיסטיקה.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_dynamic_draft_member_preferences.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- Read-only, permission-checked preferences for the monthly draft statistics table.
-- Monthly value is a TARGET (not a hard maximum). Weekly value is a hard cap.
-- פונקציית מסד public.get_dynamic_draft_member_preferences: שליפה או חישוב של דינמי / טיוטה.
create or replace function public.get_dynamic_draft_member_preferences(requested_draft_id uuid)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = ''
as $function$
declare
  -- v_user — משתמש.
  v_user uuid := auth.uid();
  -- v_draft — טיוטה.
  v_draft public.dynamic_schedule_shadow_drafts%rowtype;
  v_job public.job_types%rowtype;
begin
  -- הסתעפות לפי התנאי v_user is null then raise exception 'not authenticated'; end if;.
  if v_user is null then raise exception 'not authenticated'; end if;
  select * into v_draft from public.dynamic_schedule_shadow_drafts where id=requested_draft_id;
  -- הסתעפות לפי התנאי v_draft.id is null then raise exception 'draft not found'; end if;.
  if v_draft.id is null then raise exception 'draft not found'; end if;
  -- הסתעפות לפי התנאי not public.has_dynamic_job_type_permission('schedule.view_team',v_draft.job_type_id,v_user).
  if not public.has_dynamic_job_type_permission('schedule.view_team',v_draft.job_type_id,v_user) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;
  select * into v_job from public.job_types where id=v_draft.job_type_id;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', m.user_id,
      'monthlyTarget', case when coalesce((v_job.availability_config->>'showEmployeePreferences')::boolean,true) then sub.target_shifts else null end,
      'weeklyMaximum', case when coalesce((v_job.availability_config->>'showWeeklyShiftLimit')::boolean,false) then sub.max_weekly_shifts else null end,
      'monthlyEnabled', coalesce((v_job.availability_config->>'showEmployeePreferences')::boolean,true),
      'weeklyEnabled', coalesce((v_job.availability_config->>'showWeeklyShiftLimit')::boolean,false),
      'hasSubmission', sub.id is not null
    ) order by m.user_id)
    from public.job_type_memberships m
    join public.profiles profile on profile.id=m.user_id and profile.is_active=true
    left join public.dynamic_availability_submissions sub
      on sub.period_id=v_draft.availability_period_id and sub.user_id=m.user_id
    where m.job_type_id=v_draft.job_type_id
  ),'[]'::jsonb);
end;
$function$;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.get_dynamic_draft_member_preferences(uuid) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_draft_member_preferences(uuid) to authenticated;
