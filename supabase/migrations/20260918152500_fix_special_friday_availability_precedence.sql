begin;

-- Fix dynamic availability precedence on special Fridays/Saturdays.
-- A calendar event (for example Chol Hamoed) remains metadata/source context,
-- but an inherited special-day rule no longer turns Friday into a weekday.

create or replace function public.materialize_dynamic_availability_period_slots(
  requested_period_id uuid
)
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare
  period_row public.dynamic_availability_periods%rowtype;
  target_month date;
  materialization_row public.job_type_schedule_materializations%rowtype;
  day_date date;
  dow_value integer;
  source_day_kind_value text;
  base_day_kind_value text;
  effective_day_kind_value text;
  holiday_name_value text;
  day_behavior text;
  inherit_day_kind_value text;
  day_works boolean;
  shift_row public.job_type_materialized_shift_templates%rowtype;
  created_slots integer := 0;
  existing_slots integer := 0;
  pay_snapshot jsonb;
begin
  select * into period_row
  from public.dynamic_availability_periods
  where id=requested_period_id;

  if period_row.id is null then
    raise exception 'dynamic availability period not found';
  end if;

  select count(*) into existing_slots
  from public.dynamic_availability_slots
  where period_id=period_row.id;

  -- Never rebuild an already materialized period implicitly. This protects
  -- existing employee entries from being detached from their original slots.
  if existing_slots > 0 then
    return existing_slots;
  end if;

  target_month := make_date(period_row.year,period_row.month,1);

  select * into materialization_row
  from public.job_type_schedule_materializations m
  where m.job_type_id=period_row.job_type_id
    and m.effective_month<=target_month
  order by m.effective_month desc
  limit 1;

  if materialization_row.id is null then
    raise exception 'no effective role materialization exists for job type % in %/%',
      period_row.job_type_id,period_row.month,period_row.year;
  end if;

  for day_date in
    select d::date
    from generate_series(
      target_month,
      (target_month + interval '1 month - 1 day')::date,
      interval '1 day'
    ) d
  loop
    dow_value := extract(dow from day_date)::integer;
    base_day_kind_value := case
      when dow_value=5 then 'friday'
      when dow_value=6 then 'saturday'
      else 'weekday'
    end;
    holiday_name_value := null;
    source_day_kind_value := null;

    select csd.schedule_type,csd.event_name
      into source_day_kind_value,holiday_name_value
    from public.calendar_special_days csd
    where csd.event_date=day_date
    order by
      case when csd.source_name='manual' then 0 else 1 end,
      case csd.schedule_type
        when 'holiday_full' then 1
        when 'holiday_end' then 2
        when 'holiday_eve' then 3
        when 'chol_hamoed' then 4
        else 5
      end
    limit 1;

    if source_day_kind_value is null then
      source_day_kind_value := base_day_kind_value;
    end if;

    day_behavior := 'own_templates';
    inherit_day_kind_value := null;
    day_works := true;

    select d.behavior,d.inherit_day_kind,d.works
      into day_behavior,inherit_day_kind_value,day_works
    from public.job_type_materialized_day_rules d
    where d.materialization_id=materialization_row.id
      and d.day_kind=source_day_kind_value
    limit 1;

    -- If no explicit rule exists, use the source day itself.
    day_behavior := coalesce(day_behavior,'own_templates');
    day_works := coalesce(day_works,true);

    if day_works is false or day_behavior='no_work' then
      continue;
    end if;

    -- A special calendar label must not erase the structural weekday.
    -- When a special-day rule merely inherits another day pattern, Friday and
    -- Saturday keep their own configured templates. An explicit own_templates
    -- special-day rule still wins, so role authors can intentionally override it.
    effective_day_kind_value := case
      when day_behavior='inherit'
        and source_day_kind_value <> base_day_kind_value
        and base_day_kind_value in ('friday','saturday')
        then base_day_kind_value
      when day_behavior='inherit' then coalesce(inherit_day_kind_value,source_day_kind_value)
      else source_day_kind_value
    end;

    for shift_row in
      select s.*
      from public.job_type_materialized_shift_templates s
      where s.materialization_id=materialization_row.id
        and s.day_kind=effective_day_kind_value
        and s.is_active=true
      order by s.sort_order,s.start_time,s.code
    loop
      select coalesce(jsonb_agg(jsonb_build_object(
        'type',pc.component_type,
        'multiplier',pc.multiplier,
        'hours',pc.hours,
        'label',pc.label,
        'metadata',pc.metadata
      ) order by pc.created_at),'[]'::jsonb)
      into pay_snapshot
      from public.job_type_materialized_pay_components pc
      where pc.shift_template_id=shift_row.id;

      insert into public.dynamic_availability_slots(
        period_id,
        shift_date,
        template_id,
        shift_code,
        shift_name,
        start_time,
        end_time,
        source_day_kind,
        effective_day_kind,
        holiday_name,
        min_workers,
        target_workers,
        max_workers,
        pay_segments_snapshot,
        metadata
      ) values (
        period_row.id,
        day_date,
        null,
        shift_row.code,
        shift_row.name,
        shift_row.start_time,
        shift_row.end_time,
        source_day_kind_value,
        effective_day_kind_value,
        holiday_name_value,
        shift_row.required_workers,
        shift_row.required_workers,
        shift_row.required_workers,
        pay_snapshot,
        jsonb_build_object(
          'source','dynamic_role_materialization',
          'materializationId',materialization_row.id,
          'materializedTemplateId',shift_row.id,
          'workMode',materialization_row.work_mode,
          'effectiveMonth',materialization_row.effective_month,
          'contains200Percent',shift_row.contains_200_percent,
          'premium200Hours',shift_row.premium_200_hours
        )
      )
      on conflict(period_id,shift_date,shift_code) do nothing;

      if found then
        created_slots := created_slots + 1;
      end if;
    end loop;
  end loop;

  update public.dynamic_availability_periods
  set config_snapshot = coalesce(materialization_row.source_snapshot->'availabilityConfig',config_snapshot),
      updated_at=now()
  where id=period_row.id;

  return created_slots;
end;
$function$;


revoke all on function public.materialize_dynamic_availability_period_slots(uuid) from public;

-- Repair already-open periods that were materialized with the old precedence.
-- Only periods that actually contain an inherited special Friday/Saturday with
-- the wrong effective day kind are rebuilt. Existing submitted answers for such
-- a period are reset because slot ids/times structurally change.
do $repair$
declare
  p record;
  affected_users uuid[];
  affected_user uuid;
  notification_id uuid;
  rebuilt integer;
begin
  for p in
    select distinct ap.id, ap.job_type_id, ap.year, ap.month, jt.name as job_type_name
    from public.dynamic_availability_periods ap
    join public.job_types jt on jt.id=ap.job_type_id
    join public.dynamic_availability_slots s on s.period_id=ap.id
    join lateral (
      select m.id
      from public.job_type_schedule_materializations m
      where m.job_type_id=ap.job_type_id
        and m.effective_month<=make_date(ap.year,ap.month,1)
      order by m.effective_month desc
      limit 1
    ) mat on true
    join public.job_type_materialized_day_rules dr
      on dr.materialization_id=mat.id
     and dr.day_kind=s.source_day_kind
    where ap.status='open'
      and extract(dow from s.shift_date)::integer in (5,6)
      and s.source_day_kind not in ('friday','saturday')
      and dr.behavior='inherit'
      and s.effective_day_kind <> case
        when extract(dow from s.shift_date)::integer=5 then 'friday'
        else 'saturday'
      end
  loop
    select coalesce(array_agg(sub.user_id),array[]::uuid[])
      into affected_users
    from public.dynamic_availability_submissions sub
    where sub.period_id=p.id
      and sub.status in ('submitted','reopened');

    delete from public.dynamic_availability_slots where period_id=p.id;
    rebuilt := public.materialize_dynamic_availability_period_slots(p.id);

    update public.dynamic_availability_submissions sub
    set status='draft',submitted_at=null,updated_at=now()
    where sub.period_id=p.id
      and sub.user_id=any(affected_users);

    foreach affected_user in array affected_users loop
      begin
        insert into public.notifications(
          type,priority,source,title,body,url,data,created_by,expires_at
        ) values (
          'system','important','dynamic_availability',
          'תקופת האילוצים עודכנה',
          concat(
            coalesce(p.job_type_name,'התפקיד'),
            ' · תבניות ימי שישי/שבת בחודש ',lpad(p.month::text,2,'0'),'/',p.year,
            ' תוקנו בהתאם להגדרת התפקיד. ההגשה הקודמת הוחזרה לטיוטה ויש לאשר את האילוצים מחדש.'
          ),
          '/my-availability',
          jsonb_build_object(
            'workflow','dynamic_availability',
            'event','calendar_day_precedence_fixed',
            'jobTypeId',p.job_type_id,
            'periodId',p.id,
            'year',p.year,
            'month',p.month,
            'recipientUserId',affected_user,
            'pushPending',true
          ),
          null,
          now()+interval '90 days'
        ) returning id into notification_id;

        insert into public.notification_recipients(notification_id,user_id)
        values(notification_id,affected_user)
        on conflict do nothing;
      exception when others then
        raise warning 'special-day availability repair notification failed for user %: %',affected_user,sqlerrm;
      end;
    end loop;

    insert into public.audit_logs(action,actor_user_id,entity_type,entity_id,summary,metadata)
    values(
      'system_event',null,'dynamic_availability_period',p.id,
      'תוקנה קדימות יום שישי/שבת בתקופת אילוצים',
      jsonb_build_object(
        'job_type_id',p.job_type_id,
        'year',p.year,
        'month',p.month,
        'rebuilt_slots',rebuilt,
        'reset_submissions',coalesce(array_length(affected_users,1),0)
      )
    );
  end loop;
end;
$repair$;

commit;
