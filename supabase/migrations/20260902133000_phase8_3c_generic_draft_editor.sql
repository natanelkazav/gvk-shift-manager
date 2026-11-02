-- קובץ: supabase/migrations/20260902133000_phase8_3c_generic_draft_editor.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור טיוטה.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.dynamic_refresh_draft_metrics, public.dynamic_shadow_assignment_engine_user, public.get_dynamic_schedule_draft_editor, public.set_dynamic_schedule_draft_assignment, public.remove_dynamic_schedule_draft_assignment, public.set_dynamic_schedule_slot_intentionally_unassigned, public.publish_dynamic_schedule_draft.
-- - מבני טבלאות: public.dynamic_schedule_shadow_assignments, public.dynamic_schedule_draft_slot_overrides, public.dynamic_schedule_published_assignments, public.dynamic_schedule_published_unassigned.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- עדכון מבנה או הגדרות הטבלה public.dynamic_schedule_shadow_assignments.
alter table public.dynamic_schedule_shadow_assignments
  add column if not exists engine_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists manager_edited_by uuid references public.profiles(id) on delete set null,
  add column if not exists manager_edited_at timestamptz,
  add column if not exists manager_override_note text;

-- עדכון רשומות ב־public.dynamic_schedule_shadow_assignments בהתאם לקלט ולתנאים להלן.
update public.dynamic_schedule_shadow_assignments
set engine_user_id = user_id
where engine_user_id is null;

-- הגדרת מבנה הטבלה public.dynamic_schedule_draft_slot_overrides והאילוצים המופיעים בהמשך.
create table if not exists public.dynamic_schedule_draft_slot_overrides (
  draft_id uuid not null references public.dynamic_schedule_shadow_drafts(id) on delete cascade,
  slot_id uuid not null references public.dynamic_availability_slots(id) on delete cascade,
  intentionally_unassigned_count integer not null default 0 check (intentionally_unassigned_count >= 0),
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (draft_id, slot_id)
);

-- עדכון מבנה או הגדרות הטבלה public.dynamic_schedule_draft_slot_overrides.
alter table public.dynamic_schedule_draft_slot_overrides enable row level security;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on public.dynamic_schedule_draft_slot_overrides from anon, authenticated;

-- עדכון מבנה או הגדרות הטבלה public.dynamic_schedule_published_assignments.
alter table public.dynamic_schedule_published_assignments
  add column if not exists engine_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists manager_edited boolean not null default false,
  add column if not exists manager_override_note text;

-- הגדרת מבנה הטבלה public.dynamic_schedule_published_unassigned והאילוצים המופיעים בהמשך.
create table if not exists public.dynamic_schedule_published_unassigned (
  publication_id uuid not null references public.dynamic_schedule_publications(id) on delete cascade,
  slot_id uuid references public.dynamic_availability_slots(id) on delete set null,
  shift_date date not null,
  shift_code text not null,
  shift_name text not null,
  intentionally_unassigned_count integer not null check (intentionally_unassigned_count > 0),
  note text,
  created_at timestamptz not null default now(),
  primary key (publication_id, shift_date, shift_code)
);

-- עדכון מבנה או הגדרות הטבלה public.dynamic_schedule_published_unassigned.
alter table public.dynamic_schedule_published_unassigned enable row level security;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on public.dynamic_schedule_published_unassigned from anon, authenticated;

-- פונקציית מסד public.dynamic_refresh_draft_metrics: דינמי / טיוטה.
create or replace function public.dynamic_refresh_draft_metrics(requested_draft_id uuid)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  -- v_draft — טיוטה.
  v_draft public.dynamic_schedule_shadow_drafts%rowtype;
  v_unfilled integer := 0;
  v_intentional integer := 0;
  v_effective integer := 0;
  v_manager_edits integer := 0;
  v_metrics jsonb;
begin
  select * into v_draft from public.dynamic_schedule_shadow_drafts where id=requested_draft_id;
  -- הסתעפות לפי התנאי v_draft.id is null then raise exception 'draft not found'; end if;.
  if v_draft.id is null then raise exception 'draft not found'; end if;

  select coalesce(sum(greatest(sl.min_workers - coalesce(a.cnt,0), 0)),0)::integer
  into v_unfilled
  from public.dynamic_availability_slots sl
  left join (
    select slot_id,count(*)::integer cnt
    from public.dynamic_schedule_shadow_assignments
    where draft_id=requested_draft_id and assignment_tier='required'
    group by slot_id
  ) a on a.slot_id=sl.id
  where sl.period_id=v_draft.availability_period_id;

  select coalesce(sum(least(o.intentionally_unassigned_count, greatest(sl.min_workers-coalesce(a.cnt,0),0))),0)::integer
  into v_intentional
  from public.dynamic_availability_slots sl
  left join (
    select slot_id,count(*)::integer cnt
    from public.dynamic_schedule_shadow_assignments
    where draft_id=requested_draft_id and assignment_tier='required'
    group by slot_id
  ) a on a.slot_id=sl.id
  left join public.dynamic_schedule_draft_slot_overrides o
    on o.draft_id=requested_draft_id and o.slot_id=sl.id
  where sl.period_id=v_draft.availability_period_id;

  v_effective := greatest(v_unfilled-v_intentional,0);

  select count(*)::integer into v_manager_edits
  from public.dynamic_schedule_shadow_assignments
  where draft_id=requested_draft_id
    and (manager_edited_at is not null or (engine_user_id is not null and engine_user_id<>user_id));

  v_metrics := coalesce(v_draft.metrics,'{}'::jsonb) || jsonb_build_object(
    'unfilledRequiredPositions',v_unfilled,
    'intentionalUnfilledRequiredPositions',v_intentional,
    'effectiveUnfilledRequiredPositions',v_effective,
    'managerEditedAssignments',v_manager_edits
  );

  -- עדכון רשומות ב־public.dynamic_schedule_shadow_drafts בהתאם לקלט ולתנאים להלן.
  update public.dynamic_schedule_shadow_drafts
  set metrics=v_metrics,
      status=case when v_effective>0 then 'incomplete' else 'generated' end,
      updated_at=now()
  where id=requested_draft_id;

  return v_metrics;
end;
$function$;

-- פונקציית מסד public.dynamic_shadow_assignment_engine_user: דינמי / טיוטות שיבוץ במנגנון הדינמי / הקצאה / משתמש.
create or replace function public.dynamic_shadow_assignment_engine_user()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  -- הסתעפות לפי התנאי new.engine_user_id is null then new.engine_user_id := new.user_id; end if;.
  if new.engine_user_id is null then new.engine_user_id := new.user_id; end if;
  return new;
end;
$function$;

drop trigger if exists dynamic_shadow_assignment_engine_user_trg on public.dynamic_schedule_shadow_assignments;
create trigger dynamic_shadow_assignment_engine_user_trg
before insert on public.dynamic_schedule_shadow_assignments
for each row execute function public.dynamic_shadow_assignment_engine_user();

-- פונקציית מסד public.get_dynamic_schedule_draft_editor: שליפה או חישוב של דינמי / שיבוץ / טיוטה.
create or replace function public.get_dynamic_schedule_draft_editor(requested_draft_id uuid)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  -- v_user — משתמש.
  v_user uuid := auth.uid();
  d public.dynamic_schedule_shadow_drafts%rowtype;
  j public.job_types%rowtype;
  p public.dynamic_availability_periods%rowtype;
  v_metrics jsonb;
begin
  -- הסתעפות לפי התנאי v_user is null then raise exception 'not authenticated'; end if;.
  if v_user is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.user_permissions up where up.user_id=v_user and up.permission_key in ('users.view','user.
  if not exists(select 1 from public.user_permissions up where up.user_id=v_user and up.permission_key in ('users.view','users.manage')) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  select * into d from public.dynamic_schedule_shadow_drafts where id=requested_draft_id;
  -- הסתעפות לפי התנאי d.id is null then raise exception 'draft not found'; end if;.
  if d.id is null then raise exception 'draft not found'; end if;
  select * into j from public.job_types where id=d.job_type_id;
  select * into p from public.dynamic_availability_periods where id=d.availability_period_id;
  v_metrics := public.dynamic_refresh_draft_metrics(d.id);

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'draftId',d.id,'jobTypeId',d.job_type_id,'jobTypeName',j.name,
    'year',d.year,'month',d.month,'status',(select status from public.dynamic_schedule_shadow_drafts where id=d.id),
    'metrics',v_metrics,
    'slots',coalesce((
      select jsonb_agg(jsonb_build_object(
        'slotId',sl.id,'date',sl.shift_date,'shiftCode',sl.shift_code,'shiftName',sl.shift_name,
        'startTime',sl.start_time,'endTime',sl.end_time,
        'minWorkers',sl.min_workers,'targetWorkers',sl.target_workers,'maxWorkers',sl.max_workers,
        'intentionallyUnassignedCount',least(coalesce(o.intentionally_unassigned_count,0),greatest(sl.min_workers-coalesce(ac.required_count,0),0)),
        'overrideNote',o.note,
        'assignments',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',a.id,'userId',a.user_id,'displayName',ap.display_name,
            'engineUserId',a.engine_user_id,'engineDisplayName',ep.display_name,
            'tier',a.assignment_tier,'score',a.score,'reasons',a.reasons,
            'managerEdited',a.manager_edited_at is not null or (a.engine_user_id is not null and a.engine_user_id<>a.user_id),
            'managerOverrideNote',a.manager_override_note
          ) order by case when a.assignment_tier='required' then 0 else 1 end, ap.display_name)
          from public.dynamic_schedule_shadow_assignments a
          join public.profiles ap on ap.id=a.user_id
          left join public.profiles ep on ep.id=a.engine_user_id
          where a.draft_id=d.id and a.slot_id=sl.id
        ),'[]'::jsonb),
        'candidates',coalesce((
          select jsonb_agg(jsonb_build_object(
            'userId',m.user_id,'displayName',mp.display_name,
            'availabilityStatus',e.availability_status,
            'assignedCount',(select count(*) from public.dynamic_schedule_shadow_assignments xa where xa.draft_id=d.id and xa.user_id=m.user_id),
            'maximum',t.requested_max,
            'isAssignedHere',exists(select 1 from public.dynamic_schedule_shadow_assignments xa where xa.draft_id=d.id and xa.slot_id=sl.id and xa.user_id=m.user_id)
          ) order by
            case e.availability_status when 'preferred' then 0 when 'available' then 1 when 'avoid' then 2 when 'unavailable' then 3 else 4 end,
            mp.display_name)
          from public.job_type_memberships m
          join public.profiles mp on mp.id=m.user_id and mp.is_active=true
          left join public.dynamic_availability_submissions sub on sub.period_id=p.id and sub.user_id=m.user_id
          left join public.dynamic_availability_entries e on e.submission_id=sub.id and e.slot_id=sl.id
          left join public.dynamic_schedule_shadow_targets t on t.draft_id=d.id and t.user_id=m.user_id
          where m.job_type_id=d.job_type_id
        ),'[]'::jsonb)
      ) order by sl.shift_date,sl.start_time,sl.shift_name)
      from public.dynamic_availability_slots sl
      left join (
        select slot_id,count(*) filter(where assignment_tier='required')::integer required_count
        from public.dynamic_schedule_shadow_assignments where draft_id=d.id group by slot_id
      ) ac on ac.slot_id=sl.id
      left join public.dynamic_schedule_draft_slot_overrides o on o.draft_id=d.id and o.slot_id=sl.id
      where sl.period_id=p.id
    ),'[]'::jsonb)
  );
end;
$function$;

-- פונקציית מסד public.set_dynamic_schedule_draft_assignment: קביעת קבוצה ייחודית / דינמי / שיבוץ / טיוטה.
create or replace function public.set_dynamic_schedule_draft_assignment(
  requested_draft_id uuid,
  requested_slot_id uuid,
  requested_assignment_id uuid,
  requested_user_id uuid,
  requested_note text default null
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  -- v_user — משתמש.
  v_user uuid := auth.uid();
  d public.dynamic_schedule_shadow_drafts%rowtype;
  sl public.dynamic_availability_slots%rowtype;
  a public.dynamic_schedule_shadow_assignments%rowtype;
  -- v_assignment_id — הקצאה / מזהה.
  v_assignment_id uuid;
  v_tier text := 'required';
  -- v_count — כמות.
  v_count integer;
begin
  -- הסתעפות לפי התנאי v_user is null then raise exception 'not authenticated'; end if;.
  if v_user is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.user_permissions up where up.user_id=v_user and up.permission_key='users.manage') then r.
  if not exists(select 1 from public.user_permissions up where up.user_id=v_user and up.permission_key='users.manage') then raise exception 'not allowed'; end if;

  select * into d from public.dynamic_schedule_shadow_drafts where id=requested_draft_id;
  -- הסתעפות לפי התנאי d.id is null then raise exception 'draft not found'; end if;.
  if d.id is null then raise exception 'draft not found'; end if;
  -- הסתעפות לפי התנאי d.status not in ('generated','incomplete') then raise exception 'draft is not editable'; end if;.
  if d.status not in ('generated','incomplete') then raise exception 'draft is not editable'; end if;
  select * into sl from public.dynamic_availability_slots where id=requested_slot_id and period_id=d.availability_period_id;
  -- הסתעפות לפי התנאי sl.id is null then raise exception 'slot not found'; end if;.
  if sl.id is null then raise exception 'slot not found'; end if;
  -- הסתעפות לפי התנאי not exists(.
  if not exists(
    select 1 from public.job_type_memberships m join public.profiles p on p.id=m.user_id
    where m.job_type_id=d.job_type_id and m.user_id=requested_user_id and p.is_active=true
  ) then raise exception 'user is not an active member of this role'; end if;

  -- הסתעפות לפי התנאי requested_assignment_id is not null.
  if requested_assignment_id is not null then
    select * into a from public.dynamic_schedule_shadow_assignments
    where id=requested_assignment_id and draft_id=d.id and slot_id=sl.id;
    -- הסתעפות לפי התנאי a.id is null then raise exception 'assignment not found'; end if;.
    if a.id is null then raise exception 'assignment not found'; end if;
    -- הסתעפות לפי התנאי exists(select 1 from public.dynamic_schedule_shadow_assignments x where x.draft_id=d.id and x.slot_id=sl.id and x.user_i.
    if exists(select 1 from public.dynamic_schedule_shadow_assignments x where x.draft_id=d.id and x.slot_id=sl.id and x.user_id=requested_user_id and x.id<>a.id) then
      -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
      raise exception 'user is already assigned to this shift';
    end if;
    -- עדכון רשומות ב־public.dynamic_schedule_shadow_assignments בהתאם לקלט ולתנאים להלן.
    update public.dynamic_schedule_shadow_assignments
    set engine_user_id=coalesce(engine_user_id,user_id), user_id=requested_user_id,
        manager_edited_by=v_user,manager_edited_at=now(),manager_override_note=nullif(btrim(requested_note),'')
    where id=a.id
    returning id into v_assignment_id;
  else
    -- הסתעפות לפי התנאי exists(select 1 from public.dynamic_schedule_shadow_assignments x where x.draft_id=d.id and x.slot_id=sl.id and x.user_i.
    if exists(select 1 from public.dynamic_schedule_shadow_assignments x where x.draft_id=d.id and x.slot_id=sl.id and x.user_id=requested_user_id) then
      -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
      raise exception 'user is already assigned to this shift';
    end if;
    select count(*)::integer into v_count from public.dynamic_schedule_shadow_assignments x where x.draft_id=d.id and x.slot_id=sl.id;
    -- הסתעפות לפי התנאי v_count>=sl.max_workers then raise exception 'shift reached maximum workers'; end if;.
    if v_count>=sl.max_workers then raise exception 'shift reached maximum workers'; end if;
    v_tier := case when v_count<sl.min_workers then 'required' else 'target_optional' end;
    -- הוספת רשומות ל־public.dynamic_schedule_shadow_assignments בהתאם לקלט ולתנאים להלן.
    insert into public.dynamic_schedule_shadow_assignments(
      draft_id,slot_id,user_id,engine_user_id,assignment_tier,score,reasons,manager_edited_by,manager_edited_at,manager_override_note
    ) values(
      d.id,sl.id,requested_user_id,null,v_tier,0,jsonb_build_array('נוסף ידנית על ידי מנהל'),v_user,now(),nullif(btrim(requested_note),'')
    ) returning id into v_assignment_id;
  end if;

  perform public.dynamic_refresh_draft_metrics(d.id);
  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('system_event',v_user,'dynamic_schedule_draft',d.id,'שיבוץ בטיוטה הדינמית נערך ידנית',
    jsonb_build_object('draft_id',d.id,'slot_id',sl.id,'assignment_id',v_assignment_id,'user_id',requested_user_id));
  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object('saved',true,'assignmentId',v_assignment_id);
end;
$function$;

-- פונקציית מסד public.remove_dynamic_schedule_draft_assignment: הסרת דינמי / שיבוץ / טיוטה / הקצאה.
create or replace function public.remove_dynamic_schedule_draft_assignment(
  requested_draft_id uuid,
  requested_assignment_id uuid
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  d public.dynamic_schedule_shadow_drafts%rowtype;
  a public.dynamic_schedule_shadow_assignments%rowtype;
begin
  -- הסתעפות לפי התנאי v_user is null then raise exception 'not authenticated'; end if;.
  if v_user is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.user_permissions up where up.user_id=v_user and up.permission_key='users.manage') then r.
  if not exists(select 1 from public.user_permissions up where up.user_id=v_user and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  select * into d from public.dynamic_schedule_shadow_drafts where id=requested_draft_id;
  -- הסתעפות לפי התנאי d.id is null or d.status not in ('generated','incomplete') then raise exception 'draft is not editable'; end if;.
  if d.id is null or d.status not in ('generated','incomplete') then raise exception 'draft is not editable'; end if;
  select * into a from public.dynamic_schedule_shadow_assignments where id=requested_assignment_id and draft_id=d.id;
  -- הסתעפות לפי התנאי a.id is null then raise exception 'assignment not found'; end if;.
  if a.id is null then raise exception 'assignment not found'; end if;
  -- מחיקת הרשומות שנבחרו מתוך public.dynamic_schedule_shadow_assignments בהתאם לקלט ולתנאים להלן.
  delete from public.dynamic_schedule_shadow_assignments where id=a.id;
  perform public.dynamic_refresh_draft_metrics(d.id);
  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('system_event',v_user,'dynamic_schedule_draft',d.id,'שיבוץ הוסר מטיוטה דינמית',
    jsonb_build_object('draft_id',d.id,'slot_id',a.slot_id,'assignment_id',a.id,'user_id',a.user_id));
  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object('removed',true,'assignmentId',a.id,'slotId',a.slot_id);
end;
$function$;

-- פונקציית מסד public.set_dynamic_schedule_slot_intentionally_unassigned: קביעת קבוצה ייחודית / דינמי / שיבוץ.
create or replace function public.set_dynamic_schedule_slot_intentionally_unassigned(
  requested_draft_id uuid,
  requested_slot_id uuid,
  requested_count integer,
  requested_note text default null
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  d public.dynamic_schedule_shadow_drafts%rowtype;
  sl public.dynamic_availability_slots%rowtype;
  v_assigned integer;
  v_missing integer;
  -- v_count — כמות.
  v_count integer;
begin
  -- הסתעפות לפי התנאי v_user is null then raise exception 'not authenticated'; end if;.
  if v_user is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.user_permissions up where up.user_id=v_user and up.permission_key='users.manage') then r.
  if not exists(select 1 from public.user_permissions up where up.user_id=v_user and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  select * into d from public.dynamic_schedule_shadow_drafts where id=requested_draft_id;
  -- הסתעפות לפי התנאי d.id is null or d.status not in ('generated','incomplete') then raise exception 'draft is not editable'; end if;.
  if d.id is null or d.status not in ('generated','incomplete') then raise exception 'draft is not editable'; end if;
  select * into sl from public.dynamic_availability_slots where id=requested_slot_id and period_id=d.availability_period_id;
  -- הסתעפות לפי התנאי sl.id is null then raise exception 'slot not found'; end if;.
  if sl.id is null then raise exception 'slot not found'; end if;
  select count(*)::integer into v_assigned from public.dynamic_schedule_shadow_assignments where draft_id=d.id and slot_id=sl.id and assignment_tier='required';
  v_missing:=greatest(sl.min_workers-v_assigned,0);
  v_count:=greatest(least(coalesce(requested_count,0),v_missing),0);

  -- הסתעפות לפי התנאי v_count=0.
  if v_count=0 then
    -- מחיקת הרשומות שנבחרו מתוך public.dynamic_schedule_draft_slot_overrides בהתאם לקלט ולתנאים להלן.
    delete from public.dynamic_schedule_draft_slot_overrides where draft_id=d.id and slot_id=sl.id;
  else
    -- הוספת רשומות ל־public.dynamic_schedule_draft_slot_overrides בהתאם לקלט ולתנאים להלן.
    insert into public.dynamic_schedule_draft_slot_overrides(draft_id,slot_id,intentionally_unassigned_count,note,updated_by,updated_at)
    values(d.id,sl.id,v_count,nullif(btrim(requested_note),''),v_user,now())
    on conflict(draft_id,slot_id) do update set
      intentionally_unassigned_count=excluded.intentionally_unassigned_count,note=excluded.note,updated_by=excluded.updated_by,updated_at=now();
  end if;
  perform public.dynamic_refresh_draft_metrics(d.id);
  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('system_event',v_user,'dynamic_schedule_draft',d.id,
    case when v_count>0 then 'חוסר בטיוטה סומן כלא מאויש בכוונה' else 'סימון לא מאויש בכוונה הוסר' end,
    jsonb_build_object('draft_id',d.id,'slot_id',sl.id,'intentionally_unassigned_count',v_count));
  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object('saved',true,'slotId',sl.id,'intentionallyUnassignedCount',v_count);
end;
$function$;

-- פונקציית מסד public.publish_dynamic_schedule_draft: פרסום דינמי / שיבוץ / טיוטה.
create or replace function public.publish_dynamic_schedule_draft(requested_draft_id uuid)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=''
as $function$
declare
  current_user_id uuid:=auth.uid();
  -- target_draft — יעד / טיוטה.
  target_draft public.dynamic_schedule_shadow_drafts%rowtype;
  -- target_job — יעד.
  target_job public.job_types%rowtype;
  -- target_period — יעד / תקופה.
  target_period public.dynamic_availability_periods%rowtype;
  -- v_publication_id — מזהה.
  v_publication_id uuid;
  inserted_assignments integer:=0;
  v_metrics jsonb;
  v_unfilled integer:=0;
begin
  -- הסתעפות לפי התנאי current_user_id is null then raise exception 'not authenticated'; end if;.
  if current_user_id is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage.
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;

  select * into target_draft from public.dynamic_schedule_shadow_drafts where id=requested_draft_id;
  -- הסתעפות לפי התנאי target_draft.id is null then raise exception 'draft not found'; end if;.
  if target_draft.id is null then raise exception 'draft not found'; end if;
  select * into target_job from public.job_types where id=target_draft.job_type_id;
  select * into target_period from public.dynamic_availability_periods where id=target_draft.availability_period_id;
  -- הסתעפות לפי התנאי target_period.status <> 'closed' then raise exception 'availability period must be closed before publishing'; end if;.
  if target_period.status <> 'closed' then raise exception 'availability period must be closed before publishing'; end if;
  -- הסתעפות לפי התנאי target_draft.status not in ('generated','incomplete') then raise exception 'draft is not ready for publishing'; end if;.
  if target_draft.status not in ('generated','incomplete') then raise exception 'draft is not ready for publishing'; end if;

  v_metrics:=public.dynamic_refresh_draft_metrics(target_draft.id);
  v_unfilled:=coalesce((v_metrics->>'effectiveUnfilledRequiredPositions')::integer,0);
  -- הסתעפות לפי התנאי v_unfilled>0 then raise exception 'draft has % unfilled required positions that were not intentionally left empty',v_unf.
  if v_unfilled>0 then raise exception 'draft has % unfilled required positions that were not intentionally left empty',v_unfilled; end if;

  -- הוספת רשומות ל־public.dynamic_schedule_publications בהתאם לקלט ולתנאים להלן.
  insert into public.dynamic_schedule_publications(
    job_type_id,availability_period_id,draft_id,year,month,status,config_snapshot,published_by,published_at,updated_at
  ) values(
    target_draft.job_type_id,target_draft.availability_period_id,target_draft.id,target_draft.year,target_draft.month,'published',
    jsonb_build_object('jobType',target_job.scheduling_config,'draftMetrics',v_metrics),current_user_id,now(),now()
  ) on conflict(job_type_id,year,month) do update set
    availability_period_id=excluded.availability_period_id,draft_id=excluded.draft_id,status='published',
    config_snapshot=excluded.config_snapshot,published_by=excluded.published_by,published_at=now(),updated_at=now()
  returning id into v_publication_id;

  -- מחיקת הרשומות שנבחרו מתוך public.dynamic_schedule_published_assignments בהתאם לקלט ולתנאים להלן.
  delete from public.dynamic_schedule_published_assignments where publication_id=v_publication_id;
  -- מחיקת הרשומות שנבחרו מתוך public.dynamic_schedule_published_unassigned בהתאם לקלט ולתנאים להלן.
  delete from public.dynamic_schedule_published_unassigned where publication_id=v_publication_id;

  -- הוספת רשומות ל־public.dynamic_schedule_published_assignments בהתאם לקלט ולתנאים להלן.
  insert into public.dynamic_schedule_published_assignments(
    publication_id,source_assignment_id,slot_id,shift_date,shift_code,shift_name,start_time,end_time,user_id,
    assignment_tier,score,reasons,engine_user_id,manager_edited,manager_override_note
  )
  select v_publication_id,a.id,s.id,s.shift_date,s.shift_code,s.shift_name,s.start_time,s.end_time,a.user_id,
         a.assignment_tier,a.score,a.reasons,a.engine_user_id,
         (a.manager_edited_at is not null or (a.engine_user_id is not null and a.engine_user_id<>a.user_id)),a.manager_override_note
  from public.dynamic_schedule_shadow_assignments a
  join public.dynamic_availability_slots s on s.id=a.slot_id
  where a.draft_id=target_draft.id;
  get diagnostics inserted_assignments = row_count;

  -- הוספת רשומות ל־public.dynamic_schedule_published_unassigned בהתאם לקלט ולתנאים להלן.
  insert into public.dynamic_schedule_published_unassigned(
    publication_id,slot_id,shift_date,shift_code,shift_name,intentionally_unassigned_count,note
  )
  select v_publication_id,sl.id,sl.shift_date,sl.shift_code,sl.shift_name,
         least(o.intentionally_unassigned_count,greatest(sl.min_workers-coalesce(a.cnt,0),0)),o.note
  from public.dynamic_schedule_draft_slot_overrides o
  join public.dynamic_availability_slots sl on sl.id=o.slot_id
  left join (
    select slot_id,count(*) filter(where assignment_tier='required')::integer cnt
    from public.dynamic_schedule_shadow_assignments where draft_id=target_draft.id group by slot_id
  ) a on a.slot_id=sl.id
  where o.draft_id=target_draft.id
    and least(o.intentionally_unassigned_count,greatest(sl.min_workers-coalesce(a.cnt,0),0))>0;

  -- הוספת רשומות ל־public.audit_logs בהתאם לקלט ולתנאים להלן.
  insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
  values('system_event',current_user_id,'dynamic_schedule_publication',v_publication_id,'לוח דינמי פורסם',
    jsonb_build_object('draft_id',target_draft.id,'job_type_id',target_draft.job_type_id,'year',target_draft.year,'month',target_draft.month,'assignment_count',inserted_assignments));

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object('publicationId',v_publication_id,'published',true,'assignmentCount',inserted_assignments);
end;
$function$;

-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.dynamic_refresh_draft_metrics(uuid) from public;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.get_dynamic_schedule_draft_editor(uuid) from public;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.set_dynamic_schedule_draft_assignment(uuid,uuid,uuid,uuid,text) from public;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.remove_dynamic_schedule_draft_assignment(uuid,uuid) from public;
-- הסרת ההרשאות המפורטות בפקודה מהתפקידים המצוינים בה.
revoke all on function public.set_dynamic_schedule_slot_intentionally_unassigned(uuid,uuid,integer,text) from public;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_schedule_draft_editor(uuid) to authenticated;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.set_dynamic_schedule_draft_assignment(uuid,uuid,uuid,uuid,text) to authenticated;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.remove_dynamic_schedule_draft_assignment(uuid,uuid) to authenticated;
-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.set_dynamic_schedule_slot_intentionally_unassigned(uuid,uuid,integer,text) to authenticated;

commit;
