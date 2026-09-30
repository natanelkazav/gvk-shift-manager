-- Keep the published-next-month editor at feature parity with the draft editor.
-- Published slots now expose per-member availability, so the UI can show
-- preferred / available / avoid / unavailable after publication as well.

create or replace function public.get_dynamic_published_schedule_editor(
  requested_publication_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid := auth.uid();
  v_publication public.dynamic_schedule_publications%rowtype;
  v_job public.job_types%rowtype;
  v_current_month date := date_trunc('month', (now() at time zone 'Asia/Jerusalem')::date)::date;
  v_publication_month date;
  v_editable boolean := false;
  v_reason text := null;
  v_members jsonb := '[]'::jsonb;
  v_slots jsonb := '[]'::jsonb;
begin
  if v_actor is null then raise exception 'not authenticated'; end if;

  select * into v_publication
  from public.dynamic_schedule_publications
  where id=requested_publication_id;
  if v_publication.id is null then raise exception 'publication not found'; end if;
  if not public.has_dynamic_job_type_permission('schedule.view_team', v_publication.job_type_id, v_actor) then raise exception 'not allowed'; end if;

  select * into v_job from public.job_types where id=v_publication.job_type_id;
  if v_job.id is null then raise exception 'job type not found'; end if;

  v_publication_month := make_date(v_publication.year,v_publication.month,1);
  if v_publication.status <> 'published' then
    v_reason := 'לוח זה אינו פתוח לעריכה משום שהוא בארכיון.';
  elsif v_publication_month = v_current_month
     or v_publication_month = (v_current_month + interval '1 month')::date then
    v_editable := true;
  elsif v_publication_month < v_current_month then
    v_reason := 'לוח היסטורי נשמר לקריאה בלבד.';
  else
    v_reason := 'ניתן לערוך לוח מפורסם רק בחודש הנוכחי או בחודש הבא.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object('userId',m.user_id,'displayName',p.display_name)
    order by p.display_name
  ),'[]'::jsonb)
  into v_members
  from public.job_type_memberships m
  join public.profiles p on p.id=m.user_id
  where m.job_type_id=v_publication.job_type_id
    and p.is_active=true;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'slotId',sl.id,
      'shiftDate',sl.shift_date,
      'shiftCode',sl.shift_code,
      'shiftName',sl.shift_name,
      'startTime',sl.start_time,
      'endTime',sl.end_time,
      'intentionallyUnassignedCount',coalesce(pu.intentionally_unassigned_count,0),
      'candidates',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'userId',m.user_id,
            'displayName',mp.display_name,
            'availabilityStatus',e.availability_status
          )
          order by
            case e.availability_status when 'preferred' then 0 when 'available' then 1 when 'avoid' then 2 when 'unavailable' then 3 else 4 end,
            mp.display_name
        )
        from public.job_type_memberships m
        join public.profiles mp on mp.id=m.user_id and mp.is_active=true
        left join public.dynamic_availability_submissions sub
          on sub.period_id=v_publication.availability_period_id and sub.user_id=m.user_id
        left join public.dynamic_availability_entries e
          on e.submission_id=sub.id and e.slot_id=sl.id
        where m.job_type_id=v_publication.job_type_id
      ),'[]'::jsonb),
      'assignments',coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',a.id,
            'userId',a.user_id,
            'displayName',p.display_name,
            'userIsActive',coalesce(p.is_active,false),
            'originalUserId',a.original_user_id,
            'originalDisplayName',op.display_name,
            'managerEdited',a.manager_edited,
            'managerOverrideNote',a.manager_override_note
          ) order by p.display_name
        )
        from public.dynamic_schedule_published_assignments a
        left join public.profiles p on p.id=a.user_id
        left join public.profiles op on op.id=a.original_user_id
        where a.publication_id=v_publication.id and a.slot_id=sl.id
      ),'[]'::jsonb)
    ) order by sl.shift_date,sl.start_time,sl.shift_name
  ),'[]'::jsonb)
  into v_slots
  from public.dynamic_availability_slots sl
  left join public.dynamic_schedule_published_unassigned pu
    on pu.publication_id=v_publication.id and pu.slot_id=sl.id
  where sl.period_id=v_publication.availability_period_id;

  return jsonb_build_object(
    'publicationId',v_publication.id,
    'jobTypeId',v_job.id,
    'jobTypeName',v_job.name,
    'year',v_publication.year,
    'month',v_publication.month,
    'editable',v_editable,
    'editabilityReason',v_reason,
    'members',v_members,
    'slots',v_slots
  );
end;
$function$;


grant execute on function public.get_dynamic_published_schedule_editor(uuid) to authenticated;
