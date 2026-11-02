-- קובץ: supabase/migrations/20260912211500_phase10_4_dynamic_users_assignments.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור דינמי / משתמשים / הקצאות.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.get_dynamic_user_assignment_editor, public.save_dynamic_user_assignments.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- פונקציית מסד public.get_dynamic_user_assignment_editor: שליפה או חישוב של דינמי / משתמש / הקצאה.
create or replace function public.get_dynamic_user_assignment_editor(target_user_id uuid)
returns jsonb
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
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
      where jt.is_active = true or m.user_id is not null or jm.user_id is not null
    ), '[]'::jsonb)
  );
end;
$$;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.get_dynamic_user_assignment_editor(uuid) to authenticated;

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
    where jt.id = requested_job_type_id;

    -- הסתעפות לפי התנאי configured_scope is null.
    if configured_scope is null then
      -- עצירת הפעולה עם שגיאה כאשר התנאי בבלוק מתקיים.
      raise exception 'job type not found';
    end if;

    -- הסתעפות לפי התנאי requested_is_member.
    if requested_is_member then
      -- הסתעפות לפי התנאי configured_scope <> 'flexible'.
      if configured_scope <> 'flexible' then
        requested_employment_scope := configured_scope;
      elsif requested_employment_scope not in ('full_time','part_time','as_much_as_possible') then
        requested_employment_scope := 'full_time';
      end if;

      -- הוספת רשומות ל־public.job_type_memberships בהתאם לקלט ולתנאים להלן.
      insert into public.job_type_memberships(
        user_id, job_type_id, is_primary, source, metadata
      ) values (
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
      insert into public.job_type_managers(job_type_id, user_id, created_by)
      values(requested_job_type_id, target_user_id, actor)
      on conflict do nothing;
    else
      -- מחיקת הרשומות שנבחרו מתוך public.job_type_managers בהתאם לקלט ולתנאים להלן.
      delete from public.job_type_managers
      where job_type_id = requested_job_type_id and user_id = target_user_id;
    end if;
  end loop;
end;
$$;

-- הקצאת ההרשאות המפורטות בפקודה לתפקידים המצוינים בה.
grant execute on function public.save_dynamic_user_assignments(uuid, jsonb) to authenticated;

commit;
