-- קובץ: supabase/migrations/20261013210000_track_auto_filled_availability.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור אילוצים וזמינות.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.save_my_dynamic_availability_submission.
-- - מבני טבלאות: public.dynamic_availability_entries.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- עדכון מבנה או הגדרות הטבלה public.dynamic_availability_entries.
alter table public.dynamic_availability_entries add column if not exists auto_filled boolean not null default false;


-- פונקציית מסד public.save_my_dynamic_availability_submission: שמירת דינמי / אילוצים וזמינות.
create or replace function public.save_my_dynamic_availability_submission(
  requested_job_type_id uuid,
  requested_year integer,
  requested_month integer,
  requested_payload jsonb
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid();
  job public.job_types%rowtype;
  -- period — תקופה.
  period public.dynamic_availability_periods%rowtype;
  -- v_submission_id — מזהה.
  v_submission_id uuid;
  -- entry_item — רשומה / פריט.
  entry_item jsonb;
  allowed_statuses jsonb;
  -- requested_status — סטטוס.
  requested_status text;
  -- requested_submission_status — מצב ההגשה.
  requested_submission_status text;
  valid_entry_count integer:=0;
  total_slot_count integer:=0;
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.job_type_memberships m where m.user_id=current_user_id and m.job_type_id=requested_job_t.
  if not exists(select 1 from public.job_type_memberships m where m.user_id=current_user_id and m.job_type_id=requested_job_type_id) then raise exception 'not a member of this job type'; end if;
  select * into job from public.job_types where id=requested_job_type_id and is_active=true;
  -- הסתעפות לפי התנאי job.id is null then raise exception 'job type not found'; end if;.
  if job.id is null then raise exception 'job type not found'; end if;
  select * into period from public.dynamic_availability_periods where job_type_id=job.id and year=requested_year and month=requested_month;
  -- הסתעפות לפי התנאי period.id is null then raise exception 'dynamic period not found'; end if;.
  if period.id is null then raise exception 'dynamic period not found'; end if;
  -- הסתעפות לפי התנאי period.status <> 'open' then raise exception 'availability period is not open'; end if;.
  if period.status <> 'open' then raise exception 'availability period is not open'; end if;
  -- הסתעפות לפי התנאי period.submission_deadline is not null and now()>period.submission_deadline then raise exception 'submission deadline ha.
  if period.submission_deadline is not null and now()>period.submission_deadline then raise exception 'submission deadline has passed'; end if;

  requested_submission_status:=coalesce(requested_payload->>'submissionStatus','draft');
  -- הסתעפות לפי התנאי requested_submission_status not in ('draft','submitted','reopened') then raise exception 'invalid submission status'; en.
  if requested_submission_status not in ('draft','submitted','reopened') then raise exception 'invalid submission status'; end if;
  allowed_statuses:=coalesce(job.availability_config->'statuses','["available","unavailable"]'::jsonb);

  -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
  for entry_item in select value from jsonb_array_elements(coalesce(requested_payload->'entries','[]'::jsonb)) loop
    requested_status:=entry_item->>'status';
    -- הסתעפות לפי התנאי not (allowed_statuses ? requested_status) then raise exception 'availability status % is not enabled for this job type',.
    if not (allowed_statuses ? requested_status) then raise exception 'availability status % is not enabled for this job type',requested_status; end if;
    -- הסתעפות לפי התנאי not exists(select 1 from public.dynamic_availability_slots s where s.id=(entry_item->>'slotId')::uuid and s.period_id=pe.
    if not exists(select 1 from public.dynamic_availability_slots s where s.id=(entry_item->>'slotId')::uuid and s.period_id=period.id) then raise exception 'slot does not belong to period'; end if;
    valid_entry_count:=valid_entry_count+1;
  end loop;

  select count(*) into total_slot_count from public.dynamic_availability_slots where period_id=period.id;
  -- הסתעפות לפי התנאי requested_submission_status='submitted' and valid_entry_count<>total_slot_count.
  if requested_submission_status='submitted' and valid_entry_count<>total_slot_count then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'all shifts must be marked before submission (% of %)',valid_entry_count,total_slot_count;
  end if;

  -- הוספת רשומות ל־public.dynamic_availability_submissions בהתאם לקלט ולתנאים להלן.
  insert into public.dynamic_availability_submissions(period_id,user_id,status,min_shifts,target_shifts,max_shifts,max_nights,max_weekends,max_holidays,note,submitted_at)
  values(period.id,current_user_id,requested_submission_status,
    nullif(requested_payload->>'minimum','')::integer,nullif(requested_payload->>'target','')::integer,nullif(requested_payload->>'maximum','')::integer,
    nullif(requested_payload->>'maxNights','')::integer,nullif(requested_payload->>'maxWeekends','')::integer,nullif(requested_payload->>'maxHolidays','')::integer,
    nullif(trim(coalesce(requested_payload->>'note','')),''),case when requested_submission_status='submitted' then now() else null end)
  on conflict(period_id,user_id) do update set status=excluded.status,min_shifts=excluded.min_shifts,target_shifts=excluded.target_shifts,max_shifts=excluded.max_shifts,
    max_nights=excluded.max_nights,max_weekends=excluded.max_weekends,max_holidays=excluded.max_holidays,note=excluded.note,
    submitted_at=case when excluded.status='submitted' then now() else public.dynamic_availability_submissions.submitted_at end,updated_at=now()
  returning id into v_submission_id;

  -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
  for entry_item in select value from jsonb_array_elements(coalesce(requested_payload->'entries','[]'::jsonb)) loop
    -- הוספת רשומות ל־public.dynamic_availability_entries בהתאם לקלט ולתנאים להלן.
    insert into public.dynamic_availability_entries(submission_id,slot_id,availability_status,note,auto_filled)
    values(v_submission_id,(entry_item->>'slotId')::uuid,entry_item->>'status',nullif(trim(coalesce(entry_item->>'note','')),''),coalesce((entry_item->>'autoFilled')::boolean,false))
    on conflict(submission_id,slot_id) do update set availability_status=excluded.availability_status,note=excluded.note,auto_filled=excluded.auto_filled,updated_at=now();
  end loop;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object('saved',true,'submissionId',v_submission_id,'status',requested_submission_status,'filledCount',valid_entry_count,'totalSlots',total_slot_count);
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.save_my_dynamic_availability_submission(uuid,integer,integer,jsonb) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.save_my_dynamic_availability_submission(uuid,integer,integer,jsonb) to authenticated;

commit;
