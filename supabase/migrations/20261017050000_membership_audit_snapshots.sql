-- Context-rich membership audit; preserves existing permission checks and API signature.
-- Review against any newer deployed version of this RPC before applying.
-- Applies to future changes only; historic audit records are untouched.
create or replace function public.save_dynamic_job_type_membership(
  requested_job_type_id uuid,
  requested_user_id uuid,
  requested_is_member boolean,
  requested_employment_scope text default null,
  requested_part_time_definition jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
  current_user_id uuid := auth.uid();
  target_job public.job_types%rowtype;
  normalized_scope text := nullif(trim(coalesce(requested_employment_scope,'')),'');
  should_primary boolean := false;
  previous_membership public.job_type_memberships%rowtype;
  previous_scope text;
  previous_effective_scope text;
  previous_definition jsonb;
  requested_effective_definition jsonb;
  member_name text;
  audit_context jsonb;
begin
  if current_user_id is null then raise exception 'not authenticated'; end if;
  if not exists(select 1 from public.user_permissions up where up.user_id=current_user_id and up.permission_key='users.manage') then raise exception 'not allowed'; end if;
  select * into target_job from public.job_types where id=requested_job_type_id;
  if not found then raise exception 'job type not found'; end if;
  if not exists(select 1 from public.profiles p where p.id=requested_user_id) then raise exception 'user not found'; end if;

  SELECT * INTO previous_membership FROM public.job_type_memberships
  WHERE job_type_id=requested_job_type_id AND user_id=requested_user_id;
  previous_scope := nullif(trim(previous_membership.metadata->>'employmentScope'), '');
  -- Legacy memberships may lack employmentScope; interpret them using the
  -- same defaults as the existing RPC, rather than logging a false change.
  previous_effective_scope := coalesce(
    previous_scope,
    case when target_job.employment_scope = 'flexible' then 'full_time'
         else target_job.employment_scope end
  );
  previous_definition := case
    when previous_effective_scope = 'part_time'
      then coalesce(previous_membership.metadata->'partTimeDefinition', '{}'::jsonb)
    else null
  end;
  SELECT display_name INTO member_name FROM public.profiles WHERE id=requested_user_id;
  audit_context := jsonb_strip_nulls(jsonb_build_object(
    'job_type_name', target_job.name,
    'member_name', member_name,
    'member_user_id', requested_user_id,
    'previous_employment_scope', case when previous_membership.user_id is not null then previous_effective_scope else null end
  ));

  if not requested_is_member then
    delete from public.job_type_memberships where job_type_id=requested_job_type_id and user_id=requested_user_id;
    IF previous_membership.user_id IS NOT NULL THEN
      insert into public.audit_logs(user_id,action,entity_type,entity_id,summary,actor_user_id,target_user_id,old_values,new_values,metadata)
      values(current_user_id,'dynamic_job_type.member.removed','job_type',requested_job_type_id,'עובד הוסר מתפקיד דינמי',current_user_id,requested_user_id,
        jsonb_strip_nulls(jsonb_build_object('is_member',true,'employment_scope',previous_effective_scope,'part_time_definition',previous_definition)),
        jsonb_build_object('is_member',false),
        jsonb_build_object('userId',requested_user_id,'job_type_id',requested_job_type_id,'audit_context',audit_context));
    END IF;
    return jsonb_build_object('saved',true,'isMember',false);
  end if;

  if target_job.employment_scope='flexible' then
    if normalized_scope is null then normalized_scope := 'full_time'; end if;
    if normalized_scope not in ('full_time','part_time','as_much_as_possible') then raise exception 'invalid member employment scope'; end if;
  else
    normalized_scope := target_job.employment_scope;
  end if;

  requested_effective_definition := case
    when normalized_scope = 'part_time'
      then coalesce(requested_part_time_definition, '{}'::jsonb)
    else null
  end;

  should_primary := not exists(select 1 from public.job_type_memberships m where m.user_id=requested_user_id and m.is_primary=true);
  insert into public.job_type_memberships(user_id,job_type_id,is_primary,source,metadata)
  values(requested_user_id,requested_job_type_id,should_primary,'manual',
    jsonb_strip_nulls(jsonb_build_object(
      'employmentScope',normalized_scope,
      'partTimeDefinition',case when normalized_scope='part_time' then coalesce(requested_part_time_definition,'{}'::jsonb) else null end
    )))
  on conflict(user_id,job_type_id) do update set
    source='manual',
    metadata=jsonb_strip_nulls(jsonb_build_object(
      'employmentScope',normalized_scope,
      'partTimeDefinition',case when normalized_scope='part_time' then coalesce(requested_part_time_definition,'{}'::jsonb) else null end
    )),
    updated_at=now();

  IF previous_membership.user_id IS NULL
     OR previous_effective_scope IS DISTINCT FROM normalized_scope
     OR coalesce(previous_definition, '{}'::jsonb)
        IS DISTINCT FROM coalesce(requested_effective_definition, '{}'::jsonb) THEN
    insert into public.audit_logs(user_id,action,entity_type,entity_id,summary,actor_user_id,target_user_id,old_values,new_values,metadata)
    values(current_user_id,'dynamic_job_type.member.saved','job_type',requested_job_type_id,
      CASE WHEN previous_membership.user_id IS NULL THEN 'עובד צורף לתפקיד דינמי' ELSE 'הגדרות העסקה של עובד עודכנו' END,
      current_user_id,requested_user_id,
      CASE WHEN previous_membership.user_id IS NULL THEN jsonb_build_object('is_member',false)
        ELSE jsonb_strip_nulls(jsonb_build_object('is_member',true,'employment_scope',previous_effective_scope,'part_time_definition',previous_definition)) END,
      jsonb_strip_nulls(jsonb_build_object('is_member',true,'employment_scope',normalized_scope,
        'part_time_definition',CASE WHEN normalized_scope='part_time' THEN COALESCE(requested_part_time_definition,'{}'::jsonb) ELSE NULL END)),
      jsonb_build_object('userId',requested_user_id,'job_type_id',requested_job_type_id,
        'employmentScope',normalized_scope,
        'audit_context',audit_context || jsonb_build_object('new_employment_scope',normalized_scope)));
  END IF;
  return jsonb_build_object('saved',true,'isMember',true,'employmentScope',normalized_scope);
end;$function$;
