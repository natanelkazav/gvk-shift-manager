begin;

-- Phase 9.1.1: hotfix PL/pgSQL record-variable/table-alias collision in pilot QA report.
-- Generic runtime checks are job_type_id based. The GVK reconciliation section
-- is intentionally isolated to the pilot migration adapter.

create or replace function public.get_dynamic_pilot_qa_report()
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid := auth.uid();
  v_checks jsonb := '[]'::jsonb;
  v_fail_count integer := 0;
  v_warn_count integer := 0;
  v_pass_count integer := 0;
  v_count integer := 0;
  v_cutover boolean := false;
  v_active_job_types integer := 0;
  v_active_memberships integer := 0;
  v_dynamic_users integer := 0;
  v_publications integer := 0;
  v_assignments integer := 0;
  v_pending_exchanges integer := 0;
  v_latest_run public.gvk_legacy_migration_runs%rowtype;
  v_reconciliation jsonb := '[]'::jsonb;
  v_current_ym integer := extract(year from (now() at time zone 'Asia/Jerusalem'))::integer * 100
    + extract(month from (now() at time zone 'Asia/Jerusalem'))::integer;
  v_rec record;
begin
  if v_actor is null then raise exception 'not authenticated'; end if;
  if not exists(
    select 1 from public.user_permissions up
    where up.user_id=v_actor and up.permission_key='users.manage'
  ) then raise exception 'not allowed'; end if;

  select coalesce(dynamic_first_enabled,false)
    into v_cutover
  from public.dynamic_cutover_settings
  where singleton=true;

  select count(*) into v_active_job_types
  from public.job_types jt where jt.is_active=true;

  select count(*) into v_active_memberships
  from public.job_type_memberships m
  join public.job_types jt on jt.id=m.job_type_id and jt.is_active=true
  join public.profiles p on p.id=m.user_id and p.is_active=true;

  select count(distinct m.user_id) into v_dynamic_users
  from public.job_type_memberships m
  join public.job_types jt on jt.id=m.job_type_id and jt.is_active=true
  join public.profiles p on p.id=m.user_id and p.is_active=true;

  select count(*) into v_publications from public.dynamic_schedule_publications;
  select count(*) into v_assignments from public.dynamic_schedule_published_assignments;
  select count(*) into v_pending_exchanges
  from public.dynamic_shift_exchange_requests
  where status in ('pending_counterparty','pending_manager');

  -- 1. Cutover state.
  if v_cutover then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','cutover_enabled','status','pass','area','cutover',
      'title','Dynamic-first פעיל','message','הפיילוט משתמש ב-Dynamic-first כברירת מחדל למשתמשים עם שיוך דינמי פעיל.','count',1
    )); v_pass_count := v_pass_count + 1;
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','cutover_enabled','status','warn','area','cutover',
      'title','Dynamic-first עדיין כבוי','message','הנתונים מוכנים לבדיקה, אך ברירת המחדל עדיין Legacy-first.','count',1
    )); v_warn_count := v_warn_count + 1;
  end if;

  -- 2. Active dynamic runtime exists.
  if v_active_job_types > 0 and v_dynamic_users > 0 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','dynamic_runtime_population','status','pass','area','memberships',
      'title','קיימים תפקידים ומשתמשים דינמיים פעילים',
      'message',format('%s תפקידים פעילים, %s משתמשים פעילים עם שיוך דינמי.',v_active_job_types,v_dynamic_users),
      'count',v_dynamic_users
    )); v_pass_count := v_pass_count + 1;
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','dynamic_runtime_population','status','fail','area','memberships',
      'title','אין אוכלוסיית פיילוט דינמית מספקת','message','נדרש לפחות Job Type פעיל ומשתמש פעיל המשויך אליו.','count',0
    )); v_fail_count := v_fail_count + 1;
  end if;

  -- 3. Memberships must only point to active users and active job types for runtime.
  select count(*) into v_count
  from public.job_type_memberships m
  join public.profiles p on p.id=m.user_id
  join public.job_types jt on jt.id=m.job_type_id
  where p.is_active=false or jt.is_active=false;
  if v_count=0 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','inactive_memberships','status','pass','area','memberships','title','אין שיוכים פעילים לישויות מוקפאות',
      'message','לא נמצאו Memberships שמפנים למשתמש או תפקיד מוקפא.','count',0
    )); v_pass_count := v_pass_count + 1;
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','inactive_memberships','status','warn','area','memberships','title','נמצאו שיוכים למשתמש/תפקיד מוקפא',
      'message','השורות אינן נכנסות ל-runtime הפעיל, אך כדאי לנקות או לאשר שהן היסטוריות.','count',v_count
    )); v_warn_count := v_warn_count + 1;
  end if;

  -- 4. At most one primary role per user.
  select count(*) into v_count
  from (
    select m.user_id
    from public.job_type_memberships m
    where m.is_primary=true
    group by m.user_id
    having count(*)>1
  ) x;
  if v_count=0 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','single_primary_membership','status','pass','area','memberships','title','תפקיד ראשי יחיד לכל משתמש',
      'message','לא נמצאו משתמשים עם יותר מ-Job Type ראשי אחד.','count',0
    )); v_pass_count := v_pass_count + 1;
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','single_primary_membership','status','fail','area','memberships','title','יש משתמשים עם יותר מתפקיד ראשי אחד',
      'message','יש לתקן is_primary לפני Cutover מלא.','count',v_count
    )); v_fail_count := v_fail_count + 1;
  end if;

  -- 5. Every dynamic publication should have a month materialization.
  select count(*) into v_count
  from public.dynamic_schedule_publications p
  left join public.job_type_schedule_materializations m
    on m.job_type_id=p.job_type_id
   and m.effective_month=make_date(p.year,p.month,1)
  where m.id is null;
  if v_count=0 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','publication_materialization','status','pass','area','configuration','title','כל הלוחות המפורסמים קשורים להגדרת חודש קפואה',
      'message','לכל publication נמצא materialization של אותו Job Type וחודש.','count',0
    )); v_pass_count := v_pass_count + 1;
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','publication_materialization','status','fail','area','configuration','title','יש לוחות ללא Materialization חודשי',
      'message','לוחות כאלה עלולים להשתמש בהתנהגות שאינה תואמת את ההגדרה ההיסטורית של החודש.','count',v_count
    )); v_fail_count := v_fail_count + 1;
  end if;

  -- 6. Published assignments must belong to an active member of the publication job type.
  select count(*) into v_count
  from public.dynamic_schedule_published_assignments a
  join public.dynamic_schedule_publications p on p.id=a.publication_id
  left join public.job_type_memberships m on m.user_id=a.user_id and m.job_type_id=p.job_type_id
  left join public.profiles pr on pr.id=a.user_id
  where m.user_id is null or coalesce(pr.is_active,false)=false;
  if v_count=0 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','assignment_membership','status','pass','area','schedule','title','כל השיבוצים המפורסמים שייכים לחברי התפקיד',
      'message','לא נמצאו assignments לעובד שאינו חבר בתפקיד של הלוח.','count',0
    )); v_pass_count := v_pass_count + 1;
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','assignment_membership','status','fail','area','schedule','title','נמצאו שיבוצים לעובדים שאינם חברי התפקיד',
      'message','זהו blocker ל-Cutover: יש לתקן membership או את השיבוץ.','count',v_count
    )); v_fail_count := v_fail_count + 1;
  end if;

  -- 7. Published schedule should not be an empty shell.
  select count(*) into v_count
  from public.dynamic_schedule_publications p
  where not exists(select 1 from public.dynamic_schedule_published_assignments a where a.publication_id=p.id)
    and not exists(select 1 from public.dynamic_schedule_published_unassigned u where u.publication_id=p.id);
  if v_count=0 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','empty_publications','status','pass','area','schedule','title','אין לוחות מפורסמים ריקים',
      'message','כל publication מכיל שיבוץ או סימון מפורש של משמרת לא מאוישת.','count',0
    )); v_pass_count := v_pass_count + 1;
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','empty_publications','status','warn','area','schedule','title','נמצאו לוחות מפורסמים ללא תוכן',
      'message','יש לבדוק אם אלה לוחות בדיקה/היסטוריה או פרסום שגוי.','count',v_count
    )); v_warn_count := v_warn_count + 1;
  end if;

  -- 8. Availability periods that expect work should have slots.
  select count(*) into v_count
  from public.dynamic_availability_periods p
  where p.status in ('open','closed')
    and not exists(select 1 from public.dynamic_availability_slots s where s.period_id=p.id);
  if v_count=0 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','availability_slots','status','pass','area','availability','title','אין תקופות אילוצים פעילות ללא משמרות',
      'message','כל תקופה פתוחה/סגורה מכילה slots.','count',0
    )); v_pass_count := v_pass_count + 1;
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','availability_slots','status','fail','area','availability','title','יש תקופות אילוצים ללא Slots',
      'message','לא ניתן לסמוך על הגשה/שיבוץ בתקופה ללא משמרות ממומשות.','count',v_count
    )); v_fail_count := v_fail_count + 1;
  end if;

  -- 9. Submitted availability should cover all period slots.
  select count(*) into v_count
  from public.dynamic_availability_submissions sub
  where sub.status='submitted'
    and (
      (select count(*) from public.dynamic_availability_entries e where e.submission_id=sub.id)
      <
      (select count(*) from public.dynamic_availability_slots s where s.period_id=sub.period_id)
    );
  if v_count=0 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','complete_submissions','status','pass','area','availability','title','כל ההגשות הסופיות מלאות',
      'message','לא נמצאה הגשה submitted שחסרים בה סטטוסים למשמרות התקופה.','count',0
    )); v_pass_count := v_pass_count + 1;
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','complete_submissions','status','fail','area','availability','title','יש הגשות סופיות חלקיות',
      'message','Submitted חייב לכסות את כל ה-slots של התקופה.','count',v_count
    )); v_fail_count := v_fail_count + 1;
  end if;

  -- 10. Pending exchange requests must still match assignment ownership.
  select count(*) into v_count
  from public.dynamic_shift_exchange_requests r
  join public.dynamic_schedule_published_assignments ra on ra.id=r.requester_assignment_id
  left join public.dynamic_schedule_published_assignments ca on ca.id=r.counterparty_assignment_id
  where r.status in ('pending_counterparty','pending_manager')
    and (
      ra.user_id<>r.requester_user_id
      or (r.swap_type='two_way' and (ca.id is null or ca.user_id<>r.counterparty_user_id))
    );
  if v_count=0 then
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','pending_exchange_ownership','status','pass','area','exchanges','title','בקשות חילוף ממתינות עקביות עם השיבוצים',
      'message','לא נמצאה בקשה פעילה שמצב הבעלות שלה השתנה מתחת ל-workflow.','count',0
    )); v_pass_count := v_pass_count + 1;
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','pending_exchange_ownership','status','fail','area','exchanges','title','יש בקשות חילוף ממתינות שאינן עקביות',
      'message','יש לבטל/לתקן בקשות שהשיבוץ המקורי שלהן כבר השתנה.','count',v_count
    )); v_fail_count := v_fail_count + 1;
  end if;

  -- 11. GVK migration reconciliation. This is pilot-only and deliberately kept
  -- out of the generic runtime checks above.
  select * into v_latest_run
  from public.gvk_legacy_migration_runs
  where status='completed'
  order by completed_at desc nulls last, created_at desc
  limit 1;

  if v_latest_run.id is not null then
    -- Dispatcher months.
    for v_rec in
      select 'dispatcher'::text as source, sp.year, sp.month,
             count(ss.id)::integer as legacy_count,
             coalesce((select count(*) from public.dynamic_schedule_published_assignments da
                       join public.dynamic_schedule_publications dp on dp.id=da.publication_id
                       where dp.job_type_id=v_latest_run.dispatcher_job_type_id and dp.year=sp.year and dp.month=sp.month),0)::integer as dynamic_count,
             coalesce((select sum(du.intentionally_unassigned_count) from public.dynamic_schedule_published_unassigned du
                       join public.dynamic_schedule_publications dp on dp.id=du.publication_id
                       where dp.job_type_id=v_latest_run.dispatcher_job_type_id and dp.year=sp.year and dp.month=sp.month),0)::integer as unassigned_count
      from public.schedule_periods sp
      left join public.schedule_shifts ss on ss.period_id=sp.id
      where sp.status::text in ('published','archived') and (sp.year*100+sp.month)>=v_current_ym
      group by sp.id,sp.year,sp.month
      union all
      select 'on_call', sp.year, sp.month,
             count(d.id)::integer,
             coalesce((select count(*) from public.dynamic_schedule_published_assignments da
                       join public.dynamic_schedule_publications dp on dp.id=da.publication_id
                       where dp.job_type_id=v_latest_run.on_call_job_type_id and dp.year=sp.year and dp.month=sp.month),0)::integer,
             coalesce((select sum(du.intentionally_unassigned_count) from public.dynamic_schedule_published_unassigned du
                       join public.dynamic_schedule_publications dp on dp.id=du.publication_id
                       where dp.job_type_id=v_latest_run.on_call_job_type_id and dp.year=sp.year and dp.month=sp.month),0)::integer
      from public.driver_schedule_periods sp
      left join public.driver_schedule_days d on d.period_id=sp.id
      where sp.status::text in ('published','archived') and (sp.year*100+sp.month)>=v_current_ym
      group by sp.id,sp.year,sp.month
      union all
      select 'morning_driver', sp.year, sp.month,
             count(a.id)::integer,
             coalesce((select count(*) from public.dynamic_schedule_published_assignments da
                       join public.dynamic_schedule_publications dp on dp.id=da.publication_id
                       where dp.job_type_id=v_latest_run.morning_driver_job_type_id and dp.year=sp.year and dp.month=sp.month),0)::integer,
             coalesce((select sum(du.intentionally_unassigned_count) from public.dynamic_schedule_published_unassigned du
                       join public.dynamic_schedule_publications dp on dp.id=du.publication_id
                       where dp.job_type_id=v_latest_run.morning_driver_job_type_id and dp.year=sp.year and dp.month=sp.month),0)::integer
      from public.morning_driver_schedule_periods sp
      left join public.morning_driver_schedule_assignments a on a.schedule_period_id=sp.id
      where sp.status::text in ('published','archived') and (sp.year*100+sp.month)>=v_current_ym
      group by sp.id,sp.year,sp.month
      order by year,month,source
    loop
      v_reconciliation := v_reconciliation || jsonb_build_array(jsonb_build_object(
        'source',v_rec.source,'year',v_rec.year,'month',v_rec.month,
        'legacyCount',v_rec.legacy_count,'dynamicAssignedCount',v_rec.dynamic_count,
        'dynamicUnassignedCount',v_rec.unassigned_count,
        'coveredCount',v_rec.dynamic_count+v_rec.unassigned_count,
        'matches',v_rec.legacy_count=(v_rec.dynamic_count+v_rec.unassigned_count)
      ));
    end loop;

    select count(*) into v_count
    from jsonb_array_elements(v_reconciliation) item
    where coalesce((item->>'matches')::boolean,false)=false;

    if v_count=0 then
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code','gvk_live_reconciliation','status','pass','area','migration','title','התאמת לוחות GVK החיים עברה',
        'message','בכל חודש חי שהומר, הכיסוי הדינמי (מאויש + לא מאויש במכוון) תואם לכמות רשומות Legacy.','count',0
      )); v_pass_count := v_pass_count + 1;
    else
      v_checks := v_checks || jsonb_build_array(jsonb_build_object(
        'code','gvk_live_reconciliation','status','warn','area','migration','title','יש חודשי GVK עם פער בין Legacy ל-Dynamic',
        'message','הטבלה המפורטת למטה תראה אם פער 163→68 נובע מלוחות שכבר היו בדינמי או מכיסוי חסר.','count',v_count
      )); v_warn_count := v_warn_count + 1;
    end if;
  else
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','gvk_live_reconciliation','status','warn','area','migration','title','לא נמצאה הרצת מיגרציית GVK שהושלמה',
      'message','אין נתוני reconciliation לפיילוט.','count',0
    )); v_warn_count := v_warn_count + 1;
  end if;

  return jsonb_build_object(
    'generatedAt',now(),
    'readyForFullQa',v_fail_count=0,
    'summary',jsonb_build_object(
      'passes',v_pass_count,'warnings',v_warn_count,'failures',v_fail_count,
      'dynamicFirstEnabled',v_cutover,
      'activeJobTypes',v_active_job_types,
      'activeMemberships',v_active_memberships,
      'dynamicUsers',v_dynamic_users,
      'publications',v_publications,
      'assignments',v_assignments,
      'pendingExchanges',v_pending_exchanges
    ),
    'checks',v_checks,
    'gvkReconciliation',v_reconciliation
  );
end;
$function$;

revoke all on function public.get_dynamic_pilot_qa_report() from public;
grant execute on function public.get_dynamic_pilot_qa_report() to authenticated;

commit;
