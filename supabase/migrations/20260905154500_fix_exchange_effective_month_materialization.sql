-- קובץ: supabase/migrations/20260905154500_fix_exchange_effective_month_materialization.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור חודש / מימוש תצורת השיבוץ לחודש.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_my_dynamic_shift_exchange_options, public.create_dynamic_shift_exchange_request.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- Phase 8.3E.2.5: use the month-effective role materialization as the primary
-- source of truth for post-publication change mode. This fixes next-month
-- roles whose current job_types.scheduling_config intentionally remains unchanged.


-- פונקציית מסד public.get_my_dynamic_shift_exchange_options: שליפה או חישוב של החלפת משמרות.
create or replace function public.get_my_dynamic_shift_exchange_options()
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  -- current_user_id — המשתמש הנוכחי הנוכחי.
  current_user_id uuid := auth.uid();
  local_now timestamp := now() at time zone 'Asia/Jerusalem';
  -- current_month — חודש.
  current_month date := date_trunc('month', local_now::date)::date;
  -- next_month — חודש.
  next_month date := (date_trunc('month', local_now::date) + interval '1 month')::date;
  -- result — תוצאה.
  result jsonb;
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;

  with eligible_publications as (
    select p.*, jt.name job_type_name,
      (coalesce(mat.schedule_change_mode, 'none') = 'shift_exchange'
       or coalesce(p.config_snapshot #>> '{jobType,scheduleChangeMode}', 'none') = 'shift_exchange'
       or coalesce(jt.scheduling_config #>> '{scheduleChangeMode}', 'none') = 'shift_exchange') as exchange_enabled
    from public.dynamic_schedule_publications p
    join public.job_types jt on jt.id=p.job_type_id
    join public.job_type_memberships m on m.job_type_id=p.job_type_id and m.user_id=current_user_id
    left join public.job_type_schedule_materializations mat
      on mat.job_type_id=p.job_type_id
     and mat.effective_month=make_date(p.year,p.month,1)
    where p.status='published'
      and make_date(p.year,p.month,1) in (current_month, next_month)
  ), eligible as (
    select e.*
    from eligible_publications e
    where e.exchange_enabled
      and exists (
        select 1
        from public.dynamic_schedule_published_assignments a
        where a.publication_id=e.id
          and a.user_id=current_user_id
          and (a.shift_date > local_now::date or (a.shift_date = local_now::date and a.start_time > local_now::time))
      )
  )
  select jsonb_build_object(
    'hasDynamicShiftExchange', exists(select 1 from eligible),
    'publications', coalesce((select jsonb_agg(jsonb_build_object(
      'publicationId',e.id,'jobTypeId',e.job_type_id,'jobTypeName',e.job_type_name,
      'year',e.year,'month',e.month
    ) order by e.year,e.month,e.job_type_name) from eligible e),'[]'::jsonb),
    'myShifts', coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'publicationId',a.publication_id,'jobTypeId',e.job_type_id,'jobTypeName',e.job_type_name,
      'shiftDate',a.shift_date,'shiftCode',a.shift_code,'shiftName',a.shift_name,
      'startTime',a.start_time,'endTime',a.end_time,'year',e.year,'month',e.month
    ) order by a.shift_date,a.start_time)
      from eligible e join public.dynamic_schedule_published_assignments a on a.publication_id=e.id
      where a.user_id=current_user_id
        and (a.shift_date > local_now::date or (a.shift_date = local_now::date and a.start_time > local_now::time))), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(distinct jsonb_build_object(
      'userId',m.user_id,'displayName',pr.display_name,'jobTypeId',e.job_type_id
    ))
      from eligible e join public.job_type_memberships m on m.job_type_id=e.job_type_id
      join public.profiles pr on pr.id=m.user_id and pr.is_active=true
      where m.user_id<>current_user_id),'[]'::jsonb),
    'counterpartyShifts', coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'publicationId',a.publication_id,'jobTypeId',e.job_type_id,'jobTypeName',e.job_type_name,
      'assignedUserId',a.user_id,'shiftDate',a.shift_date,'shiftCode',a.shift_code,'shiftName',a.shift_name,
      'startTime',a.start_time,'endTime',a.end_time,'year',e.year,'month',e.month
    ) order by a.shift_date,a.start_time)
      from eligible e join public.dynamic_schedule_published_assignments a on a.publication_id=e.id
      where a.user_id<>current_user_id
        and (a.shift_date > local_now::date or (a.shift_date = local_now::date and a.start_time > local_now::time))), '[]'::jsonb)
  ) into result;

  return coalesce(result, jsonb_build_object(
    'hasDynamicShiftExchange',false,
    'publications','[]'::jsonb,
    'myShifts','[]'::jsonb,
    'members','[]'::jsonb,
    'counterpartyShifts','[]'::jsonb
  ));
end;
$function$;

-- פונקציית מסד public.create_dynamic_shift_exchange_request: יצירת החלפת משמרות.
create or replace function public.create_dynamic_shift_exchange_request(
  requested_swap_type text,
  requested_requester_assignment_id uuid,
  requested_counterparty_user_id uuid,
  requested_counterparty_assignment_id uuid default null
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
  -- requester_assignment — הקצאה.
  requester_assignment public.dynamic_schedule_published_assignments%rowtype;
  -- counter_assignment — הקצאה.
  counter_assignment public.dynamic_schedule_published_assignments%rowtype;
  -- target_publication — יעד.
  target_publication public.dynamic_schedule_publications%rowtype;
  -- target_job — יעד.
  target_job public.job_types%rowtype;
  -- created_request — נתוני הבקשה.
  created_request public.dynamic_shift_exchange_requests%rowtype;
  -- exchange_enabled — האם האפשרות מופעלת.
  exchange_enabled boolean;
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי requested_swap_type not in ('one_way','two_way') then raise exception 'סוג ההחלפה אינו תקין.'; end if;.
  if requested_swap_type not in ('one_way','two_way') then raise exception 'סוג ההחלפה אינו תקין.'; end if;
  -- הסתעפות לפי התנאי requested_counterparty_user_id=current_user_id then raise exception 'לא ניתן להגיש בקשה מול עצמך.'; end if;.
  if requested_counterparty_user_id=current_user_id then raise exception 'לא ניתן להגיש בקשה מול עצמך.'; end if;

  select * into requester_assignment from public.dynamic_schedule_published_assignments
  where id=requested_requester_assignment_id for update;
  -- הסתעפות לפי התנאי requester_assignment.id is null or requester_assignment.user_id<>current_user_id then raise exception 'המשמרת שנבחרה אינ.
  if requester_assignment.id is null or requester_assignment.user_id<>current_user_id then raise exception 'המשמרת שנבחרה אינה משובצת אליך.'; end if;
  -- הסתעפות לפי התנאי public.dynamic_assignment_starts_at(requester_assignment)<=now() then raise exception 'לא ניתן להחליף משמרת שכבר התחילה..
  if public.dynamic_assignment_starts_at(requester_assignment)<=now() then raise exception 'לא ניתן להחליף משמרת שכבר התחילה.'; end if;

  select * into target_publication from public.dynamic_schedule_publications where id=requester_assignment.publication_id;
  select * into target_job from public.job_types where id=target_publication.job_type_id;
  exchange_enabled := (
    exists (select 1 from public.job_type_schedule_materializations mat
      where mat.job_type_id=target_publication.job_type_id
        and mat.effective_month=make_date(target_publication.year,target_publication.month,1)
        and mat.schedule_change_mode='shift_exchange')
    or coalesce(target_publication.config_snapshot #>> '{jobType,scheduleChangeMode}', 'none') = 'shift_exchange'
    or coalesce(target_job.scheduling_config #>> '{scheduleChangeMode}', 'none') = 'shift_exchange'
  );
  -- הסתעפות לפי התנאי target_publication.status<>'published' or not exchange_enabled then raise exception 'חילופי משמרות אינם פעילים בלוח זה.'.
  if target_publication.status<>'published' or not exchange_enabled then raise exception 'חילופי משמרות אינם פעילים בלוח זה.'; end if;
  -- הסתעפות לפי התנאי make_date(target_publication.year,target_publication.month,1) not in (.
  if make_date(target_publication.year,target_publication.month,1) not in (
    date_trunc('month',(now() at time zone 'Asia/Jerusalem')::date)::date,
    (date_trunc('month',(now() at time zone 'Asia/Jerusalem')::date)+interval '1 month')::date
  ) then raise exception 'ניתן להגיש בקשות רק לחודש הנוכחי או לחודש הבא שפורסם.'; end if;

  -- הסתעפות לפי התנאי not exists(select 1 from public.job_type_memberships m join public.profiles p on p.id=m.user_id and p.is_active=true.
  if not exists(select 1 from public.job_type_memberships m join public.profiles p on p.id=m.user_id and p.is_active=true
    where m.job_type_id=target_publication.job_type_id and m.user_id=requested_counterparty_user_id) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'העובד שנבחר אינו חבר פעיל בתפקיד.';
  end if;

  -- הסתעפות לפי התנאי requested_swap_type='two_way'.
  if requested_swap_type='two_way' then
    -- הסתעפות לפי התנאי requested_counterparty_assignment_id is null then raise exception 'יש לבחור משמרת נגדית.'; end if;.
    if requested_counterparty_assignment_id is null then raise exception 'יש לבחור משמרת נגדית.'; end if;
    select * into counter_assignment from public.dynamic_schedule_published_assignments
    where id=requested_counterparty_assignment_id and publication_id=target_publication.id for update;
    -- הסתעפות לפי התנאי counter_assignment.id is null or counter_assignment.user_id<>requested_counterparty_user_id then raise exception 'המשמרת.
    if counter_assignment.id is null or counter_assignment.user_id<>requested_counterparty_user_id then raise exception 'המשמרת הנגדית אינה משובצת לעובד שנבחר.'; end if;
    -- הסתעפות לפי התנאי public.dynamic_assignment_starts_at(counter_assignment)<=now() then raise exception 'המשמרת הנגדית כבר התחילה.'; end if;.
    if public.dynamic_assignment_starts_at(counter_assignment)<=now() then raise exception 'המשמרת הנגדית כבר התחילה.'; end if;
  elsif requested_counterparty_assignment_id is not null then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'בהחלפה חד-כיוונית אין לבחור משמרת נגדית.';
  end if;

  -- הסתעפות לפי התנאי exists(select 1 from public.dynamic_shift_exchange_requests r.
  if exists(select 1 from public.dynamic_shift_exchange_requests r
    where r.status in ('pending_counterparty','pending_manager') and (
      r.requester_assignment_id=requested_requester_assignment_id or r.counterparty_assignment_id=requested_requester_assignment_id
      or (requested_counterparty_assignment_id is not null and (r.requester_assignment_id=requested_counterparty_assignment_id or r.counterparty_assignment_id=requested_counterparty_assignment_id))
    )) then raise exception 'כבר קיימת בקשת החלפה פעילה עבור אחת המשמרות.'; end if;

  -- הסתעפות לפי התנאי public.dynamic_user_has_overlap(target_publication.id, requested_counterparty_user_id, requester_assignment.id,.
  if public.dynamic_user_has_overlap(target_publication.id, requested_counterparty_user_id, requester_assignment.id,
      case when requested_swap_type='two_way' then counter_assignment.id else null end) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'ההחלפה תיצור לעובד השני משמרות חופפות.';
  end if;
  -- הסתעפות לפי התנאי requested_swap_type='two_way' and public.dynamic_user_has_overlap(target_publication.id,current_user_id,counter_assignme.
  if requested_swap_type='two_way' and public.dynamic_user_has_overlap(target_publication.id,current_user_id,counter_assignment.id,requester_assignment.id) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'ההחלפה תיצור עבורך משמרות חופפות.';
  end if;

  -- הוספת רשומות ל־public.dynamic_shift_exchange_requests בהתאם לקלט ולתנאים להלן.
  insert into public.dynamic_shift_exchange_requests(publication_id,job_type_id,swap_type,requester_user_id,counterparty_user_id,requester_assignment_id,counterparty_assignment_id)
  values(target_publication.id,target_publication.job_type_id,requested_swap_type,current_user_id,requested_counterparty_user_id,requester_assignment.id,requested_counterparty_assignment_id)
  returning * into created_request;

  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('shift_swap_created',current_user_id,'dynamic_shift_exchange_request',created_request.id,'נוצרה בקשת חילופי משמרות דינמית',jsonb_build_object('job_type_id',target_publication.job_type_id,'publication_id',target_publication.id,'swap_type',requested_swap_type));

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object('id',created_request.id,'status',created_request.status,'swapType',created_request.swap_type);
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.get_my_dynamic_shift_exchange_options() from public;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.create_dynamic_shift_exchange_request(text,uuid,uuid,uuid) from public;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_my_dynamic_shift_exchange_options() to authenticated;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.create_dynamic_shift_exchange_request(text,uuid,uuid,uuid) to authenticated;

commit;
