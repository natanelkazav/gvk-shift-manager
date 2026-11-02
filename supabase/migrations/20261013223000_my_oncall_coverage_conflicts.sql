-- קובץ: supabase/migrations/20261013223000_my_oncall_coverage_conflicts.sql
-- מטרה: הצגת התנגשויות בין הכוננות האישית לבין אילוצי הזמינות והצורך בכיסוי.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_my_oncall_coverage_conflicts.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- Read-only, authenticated conflict lookup for published daily on-call rotations.
-- A conflict is a currently assigned future shift whose employee explicitly submitted "unavailable".
-- Do not infer a conflict from missing entries or from a shift already transferred to another employee.
-- פונקציית מסד public.get_my_oncall_coverage_conflicts: שליפה או חישוב של הנתון get_my_oncall_coverage_conflicts בהקשר הפעולה.
create or replace function public.get_my_oncall_coverage_conflicts()
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  -- v_result — תוצאה.
  v_result jsonb;
begin
  -- הסתעפות לפי התנאי v_actor is null.
  if v_actor is null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not authenticated';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId', a.id,
    'publicationId', p.id,
    'jobTypeId', p.job_type_id,
    'jobTypeName', j.name,
    'shiftDate', a.shift_date,
    'shiftName', a.shift_name
  ) order by a.shift_date, a.id), '[]'::jsonb)
  into v_result
  from public.dynamic_schedule_published_assignments a
  join public.dynamic_schedule_publications p on p.id = a.publication_id
  join public.job_types j on j.id = p.job_type_id
  join public.dynamic_availability_submissions sub
    on sub.period_id = p.availability_period_id
    and sub.user_id = v_actor
    and sub.status in ('submitted', 'reopened')
  join public.dynamic_availability_entries e
    on e.submission_id = sub.id
    and e.slot_id = a.slot_id
    and e.availability_status = 'unavailable'
  where a.user_id = v_actor
    and a.shift_date >= (now() at time zone 'Asia/Jerusalem')::date
    and p.status = 'published'
    and exists (
      select 1
      from public.job_type_configuration_versions v
      where v.job_type_id = p.job_type_id
        and v.effective_month <= make_date(p.year, p.month, 1)
        and v.snapshot->>'schedulingStrategy' = 'monthly_rotation_constraints'
        and coalesce((v.snapshot->'schedulingConfig'->>'rotationExchangeEnabled')::boolean, false)
        and v.snapshot->'schedulingConfig'->>'scheduleChangeMode' = 'shift_exchange'
        and v.effective_month = (
          select max(v2.effective_month)
          from public.job_type_configuration_versions v2
          where v2.job_type_id = p.job_type_id
            and v2.effective_month <= make_date(p.year, p.month, 1)
        )
    );

  return v_result;
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.get_my_oncall_coverage_conflicts() from public, anon;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_my_oncall_coverage_conflicts() to authenticated;
