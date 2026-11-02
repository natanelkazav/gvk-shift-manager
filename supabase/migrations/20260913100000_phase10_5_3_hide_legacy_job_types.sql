-- קובץ: supabase/migrations/20260913100000_phase10_5_3_hide_legacy_job_types.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור סוגי תפקידים.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_legacy_freeze_readiness, public.get_dynamic_cutover_state, public.get_dynamic_user_assignment_editor, public.save_dynamic_user_assignments, public.get_dynamic_shifts_management_workspace.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- Phase 10.5.3 · Separate seeded Legacy Job Types from the Dynamic-first runtime.
-- Rows with job_types.legacy_role are compatibility adapters created during the
-- original migration. They remain in the database for recovery, but must not be
-- presented as operational Dynamic Job Types.

-- Remove only the synthetic memberships created by Phase 10.5.2. Real/manual
-- Dynamic memberships are never touched.
-- מחיקת הרשומות שנבחרו מתוך public.job_type_memberships בהתאם לקלט ולתנאים להלן.
delete from public.job_type_memberships m
using public.job_types jt
where m.job_type_id = jt.id
  and jt.legacy_role is not null
  and m.source = 'legacy_freeze_bridge';

-- A previously frozen state may have been satisfied only by the synthetic
-- bridge above. Re-open the freeze gate until every active legacy worker has a
-- real Dynamic Job Type membership.
-- עדכון רשומות ב־public.dynamic_cutover_settings בהתאם לקלט ולתנאים להלן.
update public.dynamic_cutover_settings s
set legacy_frozen = false,
    updated_at = now()
where s.singleton = true
  and coalesce(s.legacy_frozen, false) = true
  and exists (
    select 1
    from public.profiles p
    where p.is_active = true
      and p.role::text in ('dispatcher', 'on_call', 'morning_driver')
      and not exists (
        select 1
        from public.job_type_memberships m
        join public.job_types jt
          on jt.id = m.job_type_id
         and jt.is_active = true
         and jt.legacy_role is null
        where m.user_id = p.id
      )
  );

-- פונקציית מסד public.get_legacy_freeze_readiness: שליפה או חישוב של הנתון get_legacy_freeze_readiness בהקשר הפעולה.
create or replace function public.get_legacy_freeze_readiness()
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=public
as $$
declare
  -- v_user — משתמש.
  v_user uuid := auth.uid();
  -- v_dynamic_first — דינמי.
  v_dynamic_first boolean := false;
  -- v_missing_count — כמות.
  v_missing_count integer := 0;
  -- v_missing_users — משתמשים.
  v_missing_users jsonb := '[]'::jsonb;
begin
  -- הסתעפות לפי התנאי v_user is null then raise exception 'not authenticated'; end if;.
  if v_user is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id = v_user and up.permission_key = 'users.manage'
  ) then raise exception 'not allowed'; end if;

  select coalesce(dynamic_first_enabled, false)
    into v_dynamic_first
  from public.dynamic_cutover_settings
  where singleton = true;

  select count(*)::integer
    into v_missing_count
  from public.profiles p
  where p.is_active = true
    and p.role::text in ('dispatcher', 'on_call', 'morning_driver')
    and not exists (
      select 1
      from public.job_type_memberships m
      join public.job_types jt
        on jt.id = m.job_type_id
       and jt.is_active = true
       and jt.legacy_role is null
      where m.user_id = p.id
    );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'userId', q.id,
      'displayName', q.display_name,
      'legacyRole', q.role_text
    ) order by q.display_name
  ), '[]'::jsonb)
  into v_missing_users
  from (
    select p.id, p.display_name, p.role::text as role_text
    from public.profiles p
    where p.is_active = true
      and p.role::text in ('dispatcher', 'on_call', 'morning_driver')
      and not exists (
        select 1
        from public.job_type_memberships m
        join public.job_types jt
          on jt.id = m.job_type_id
         and jt.is_active = true
         and jt.legacy_role is null
        where m.user_id = p.id
      )
    order by p.display_name
    limit 25
  ) q;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'ready', v_dynamic_first and v_missing_count = 0,
    'dynamicFirstEnabled', v_dynamic_first,
    'missingLegacyMemberships', v_missing_count,
    'missingUsers', v_missing_users
  );
end;
$$;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_legacy_freeze_readiness() to authenticated;

-- Dynamic runtime detection must be based only on real Dynamic Job Types.
drop function if exists public.get_dynamic_cutover_state();
-- פונקציית מסד public.get_dynamic_cutover_state: שליפה או חישוב של דינמי / מעבר למנגנון הדינמי / מצב.
create function public.get_dynamic_cutover_state()
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path=public
as $$
declare
  -- v_enabled — האם האפשרות מופעלת.
  v_enabled boolean := false;
  v_legacy_frozen boolean := false;
  -- v_user — משתמש.
  v_user uuid := auth.uid();
  -- v_has_membership — שיוך לתפקיד.
  v_has_membership boolean := false;
  v_is_system_admin boolean := false;
  -- v_is_job_type_manager — סוג תפקיד.
  v_is_job_type_manager boolean := false;
  -- v_use_dynamic — דינמי.
  v_use_dynamic boolean := false;
begin
  select coalesce(dynamic_first_enabled, false), coalesce(legacy_frozen, false)
    into v_enabled, v_legacy_frozen
  from public.dynamic_cutover_settings
  where singleton = true;

  -- הסתעפות לפי התנאי v_user is not null.
  if v_user is not null then
    select exists(
      select 1
      from public.job_type_memberships m
      join public.job_types jt
        on jt.id = m.job_type_id
       and jt.is_active = true
       and jt.legacy_role is null
      where m.user_id = v_user
    ) into v_has_membership;

    select exists(
      select 1 from public.profiles p
      where p.id = v_user and p.role = 'admin' and p.is_active = true
    ) into v_is_system_admin;

    select exists(
      select 1
      from public.job_type_managers jm
      join public.job_types jt
        on jt.id = jm.job_type_id
       and jt.is_active = true
       and jt.legacy_role is null
      where jm.user_id = v_user
    ) into v_is_job_type_manager;
  end if;

  v_use_dynamic := coalesce(v_enabled, false)
    and (v_has_membership or v_is_system_admin or v_is_job_type_manager);

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'dynamicFirstEnabled', coalesce(v_enabled, false),
    'hasDynamicMembership', v_has_membership,
    'useDynamicRuntime', v_use_dynamic,
    'legacyFrozen', coalesce(v_legacy_frozen, false)
  );
end;
$$;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_cutover_state() to authenticated;

-- User assignment editor: Legacy seed adapters are not assignable in the new UI.
-- פונקציית מסד public.get_dynamic_user_assignment_editor: שליפה או חישוב של דינמי / משתמש / הקצאה.
create or replace function public.get_dynamic_user_assignment_editor(target_user_id uuid)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = public
as $$
declare actor uuid := auth.uid();
begin
  -- הסתעפות לפי התנאי actor is null then raise exception 'not authenticated'; end if;.
  if actor is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id = actor and up.permission_key in ('users.view','users.manage')
  ) then raise exception 'not allowed'; end if;
  -- הסתעפות לפי התנאי not exists (select 1 from public.profiles p where p.id = target_user_id).
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'user not found';
  end if;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'userId', target_user_id,
    'assignments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'jobTypeId', jt.id,
          'jobTypeName', jt.name,
          'jobTypeDescription', jt.description,
          'jobTypeEmploymentScope', jt.employment_scope,
          'isMember', (m.user_id is not null),
          'isManager', (jm.user_id is not null),
          'employmentScope', m.metadata->>'employmentScope',
          'partTimeDefinition', coalesce(m.metadata->'partTimeDefinition', '{}'::jsonb)
        ) order by jt.name
      )
      from public.job_types jt
      left join public.job_type_memberships m
        on m.job_type_id = jt.id and m.user_id = target_user_id
      left join public.job_type_managers jm
        on jm.job_type_id = jt.id and jm.user_id = target_user_id
      where jt.legacy_role is null
        and (jt.is_active = true or m.user_id is not null or jm.user_id is not null)
    ), '[]'::jsonb)
  );
end;
$$;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_user_assignment_editor(uuid) to authenticated;

-- Prevent the Dynamic-first user editor from creating new assignments to a
-- compatibility-only Legacy seed Job Type.
-- פונקציית מסד public.save_dynamic_user_assignments: שמירת דינמי / משתמש / הקצאות.
create or replace function public.save_dynamic_user_assignments(
  target_user_id uuid,
  requested_assignments jsonb
)
returns void
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  -- item — פריט.
  item jsonb;
  -- requested_job_type_id — מזהה סוג התפקיד.
  requested_job_type_id uuid;
  requested_is_member boolean;
  requested_is_manager boolean;
  requested_employment_scope text;
  -- requested_part_time_definition — זמן.
  requested_part_time_definition jsonb;
  configured_scope text;
begin
  -- הסתעפות לפי התנאי actor is null then raise exception 'not authenticated'; end if;.
  if actor is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1 from public.user_permissions up
    where up.user_id = actor and up.permission_key = 'users.manage'
  ) then raise exception 'not allowed'; end if;
  -- הסתעפות לפי התנאי not exists (select 1 from public.profiles p where p.id = target_user_id).
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'user not found';
  end if;
  -- הסתעפות לפי התנאי jsonb_typeof(coalesce(requested_assignments, '[]'::jsonb)) <> 'array'.
  if jsonb_typeof(coalesce(requested_assignments, '[]'::jsonb)) <> 'array' then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'requested_assignments must be an array';
  end if;

  -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
  for item in select value from jsonb_array_elements(coalesce(requested_assignments, '[]'::jsonb)) loop
    requested_job_type_id := nullif(item->>'jobTypeId','')::uuid;
    requested_is_member := coalesce((item->>'isMember')::boolean, false);
    requested_is_manager := coalesce((item->>'isManager')::boolean, false);
    requested_employment_scope := nullif(trim(coalesce(item->>'employmentScope','')), '');
    requested_part_time_definition := coalesce(item->'partTimeDefinition', '{}'::jsonb);

    select jt.employment_scope into configured_scope
    from public.job_types jt
    where jt.id = requested_job_type_id
      and jt.legacy_role is null;

    -- הסתעפות לפי התנאי configured_scope is null then raise exception 'dynamic job type not found'; end if;.
    if configured_scope is null then raise exception 'dynamic job type not found'; end if;

    -- הסתעפות לפי התנאי requested_is_member.
    if requested_is_member then
      -- הסתעפות לפי התנאי configured_scope <> 'flexible'.
      if configured_scope <> 'flexible' then
        requested_employment_scope := configured_scope;
      elsif requested_employment_scope not in ('full_time','part_time','as_much_as_possible') then
        requested_employment_scope := 'full_time';
      end if;

      -- הוספת רשומות ל־public.job_type_memberships בהתאם לקלט ולתנאים להלן.
      insert into public.job_type_memberships(user_id, job_type_id, is_primary, source, metadata)
      values (
        target_user_id,
        requested_job_type_id,
        false,
        'dynamic_users',
        jsonb_build_object(
          'employmentScope', requested_employment_scope,
          'partTimeDefinition', requested_part_time_definition
        )
      )
      on conflict (user_id, job_type_id) do update
      set source = 'dynamic_users',
          metadata = jsonb_set(
            jsonb_set(coalesce(public.job_type_memberships.metadata, '{}'::jsonb), '{employmentScope}', to_jsonb(requested_employment_scope), true),
            '{partTimeDefinition}', requested_part_time_definition, true
          ),
          updated_at = now();
    else
      -- מחיקת הרשומות שנבחרו מתוך public.job_type_memberships בהתאם לקלט ולתנאים להלן.
      delete from public.job_type_memberships
      where user_id = target_user_id and job_type_id = requested_job_type_id;
    end if;

    -- הסתעפות לפי התנאי requested_is_manager.
    if requested_is_manager then
      -- הוספת רשומות ל־public.job_type_managers בהתאם לקלט ולתנאים להלן.
      insert into public.job_type_managers(user_id, job_type_id, created_by)
      values (target_user_id, requested_job_type_id, actor)
      on conflict (user_id, job_type_id) do nothing;
    else
      -- מחיקת הרשומות שנבחרו מתוך public.job_type_managers בהתאם לקלט ולתנאים להלן.
      delete from public.job_type_managers
      where user_id = target_user_id and job_type_id = requested_job_type_id;
    end if;
  end loop;
end;
$$;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.save_dynamic_user_assignments(uuid,jsonb) to authenticated;

commit;
begin;

-- פונקציית מסד public.get_dynamic_shifts_management_workspace: שליפה או חישוב של דינמי / משמרות.
create or replace function public.get_dynamic_shifts_management_workspace(
  requested_year integer,
  requested_month integer
)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
begin
  -- הסתעפות לפי התנאי actor is null then raise exception 'not authenticated'; end if;.
  if actor is null then raise exception 'not authenticated'; end if;
  -- הסתעפות לפי התנאי requested_year not between 2020 and 2100 or requested_month not between 1 and 12.
  if requested_year not between 2020 and 2100 or requested_month not between 1 and 12 then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'invalid year or month';
  end if;

  select p.role::text into actor_role
  from public.profiles p
  where p.id = actor and p.is_active = true;
  -- הסתעפות לפי התנאי actor_role is null then raise exception 'user not active'; end if;.
  if actor_role is null then raise exception 'user not active'; end if;

  -- הסתעפות לפי התנאי not exists (.
  if not exists (
    select 1
    from public.job_types jt
    where jt.is_active = true
      and jt.legacy_role is null
      and (
        public.has_dynamic_job_type_permission('availability.view_team', jt.id, actor)
        or public.has_dynamic_job_type_permission('availability.open_period', jt.id, actor)
        or public.has_dynamic_job_type_permission('availability.close_period', jt.id, actor)
        or public.has_dynamic_job_type_permission('availability.manage_submissions', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.view_team', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.create_draft', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.edit_draft', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.publish', jt.id, actor)
        or public.has_dynamic_job_type_permission('schedule.edit_published', jt.id, actor)
        or public.has_dynamic_job_type_permission('rotation.generate', jt.id, actor)
      )
  ) then
    -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
    raise exception 'not allowed';
  end if;

  -- הרכבת תוצאת הפעולה והחזרתה לקורא.
  return jsonb_build_object(
    'year', requested_year,
    'month', requested_month,
    'generatedAt', now(),
    'roles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'jobType', public.dynamic_job_type_live_snapshot(jt.id),
          'isExplicitManager', exists (
            select 1 from public.job_type_managers jm
            where jm.user_id = actor and jm.job_type_id = jt.id
          ),
          'accessSource', case
            when actor_role = 'admin' then 'system_admin'
            else 'job_type_manager'
          end,
          'workflow', jsonb_build_object(
            'jobTypeId', jt.id,
            'jobTypeName', jt.name,
            'year', requested_year,
            'month', requested_month,
            'memberCount', (
              select count(*)::integer
              from public.job_type_memberships m
              join public.profiles p on p.id = m.user_id and p.is_active = true
              where m.job_type_id = jt.id
            ),
            'availabilityEnabled', coalesce((jt.availability_config->>'enabled')::boolean, false),
            'schedulingStrategy', coalesce(jt.scheduling_strategy, jt.scheduling_config->>'schedulingStrategy', 'availability_optimizer'),
            'period', (
              select jsonb_build_object(
                'id', ap.id,
                'status', ap.status,
                'title', ap.title,
                'submissionDeadline', ap.submission_deadline,
                'slotCount', (select count(*)::integer from public.dynamic_availability_slots s where s.period_id = ap.id),
                'submissionCount', (select count(*)::integer from public.dynamic_availability_submissions sub where sub.period_id = ap.id),
                'submittedCount', (select count(*)::integer from public.dynamic_availability_submissions sub where sub.period_id = ap.id and sub.status = 'submitted')
              )
              from public.dynamic_availability_periods ap
              where ap.job_type_id = jt.id and ap.year = requested_year and ap.month = requested_month
              limit 1
            ),
            'draft', (
              select jsonb_build_object('id', d.id, 'status', d.status, 'metrics', d.metrics, 'createdAt', d.created_at, 'updatedAt', d.updated_at)
              from public.dynamic_schedule_shadow_drafts d
              where d.job_type_id = jt.id and d.year = requested_year and d.month = requested_month
              order by d.created_at desc limit 1
            ),
            'publication', (
              select jsonb_build_object(
                'id', pub.id,
                'status', pub.status,
                'publishedAt', pub.published_at,
                'assignmentCount', (select count(*)::integer from public.dynamic_schedule_published_assignments a where a.publication_id = pub.id)
              )
              from public.dynamic_schedule_publications pub
              where pub.job_type_id = jt.id and pub.year = requested_year and pub.month = requested_month
              limit 1
            )
          )
        ) order by jt.name
      )
      from public.job_types jt
      where jt.is_active = true
        and jt.legacy_role is null
        and (
          public.has_dynamic_job_type_permission('availability.view_team', jt.id, actor)
          or public.has_dynamic_job_type_permission('availability.open_period', jt.id, actor)
          or public.has_dynamic_job_type_permission('availability.close_period', jt.id, actor)
          or public.has_dynamic_job_type_permission('availability.manage_submissions', jt.id, actor)
          or public.has_dynamic_job_type_permission('schedule.view_team', jt.id, actor)
          or public.has_dynamic_job_type_permission('schedule.create_draft', jt.id, actor)
          or public.has_dynamic_job_type_permission('schedule.edit_draft', jt.id, actor)
          or public.has_dynamic_job_type_permission('schedule.publish', jt.id, actor)
          or public.has_dynamic_job_type_permission('schedule.edit_published', jt.id, actor)
          or public.has_dynamic_job_type_permission('rotation.generate', jt.id, actor)
        )
    ), '[]'::jsonb)
  );
end;
$$;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_shifts_management_workspace(integer,integer) to authenticated;

commit;
