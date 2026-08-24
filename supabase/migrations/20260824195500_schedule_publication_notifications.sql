create or replace function public.create_schedule_publication_notification(
  requested_schedule_kind text,
  requested_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  current_permissions text[];
  required_permission text;
  recipient_role text;
  notification_title text;
  notification_body text;
  notification_url text;
  target_year integer;
  target_month integer;
  target_status text;
  notification_id uuid;
  recipient_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = current_user_id and is_active = true
  ) then
    raise exception 'user not active';
  end if;

  current_permissions := coalesce(
    public.get_my_permissions(),
    array[]::text[]
  );

  case requested_schedule_kind
    when 'dispatcher' then
      required_permission := 'schedule.edit';
      recipient_role := 'dispatcher';
      notification_title := 'לוח המשמרות פורסם';

      select period.year, period.month, period.status::text
      into target_year, target_month, target_status
      from public.schedule_periods period
      where period.id = requested_period_id;

      notification_url := concat(
        '/schedule?year=', target_year,
        '&month=', target_month
      );

    when 'driver' then
      required_permission := 'driver_schedule.edit';
      recipient_role := 'on_call';
      notification_title := 'לוח הכוננויות פורסם';

      select period.year, period.month, period.status::text
      into target_year, target_month, target_status
      from public.driver_schedule_periods period
      where period.id = requested_period_id;

      notification_url := concat(
        '/driver-schedule?year=', target_year,
        '&month=', target_month
      );

    when 'morning_driver' then
      required_permission := 'morning_driver_schedule.edit';
      recipient_role := 'morning_driver';
      notification_title := 'לוח כוננויות הבוקר פורסם';

      select period.year, period.month, period.status::text
      into target_year, target_month, target_status
      from public.morning_driver_schedule_periods period
      where period.id = requested_period_id;

      notification_url := concat(
        '/morning-driver-schedule?year=', target_year,
        '&month=', target_month
      );

    else
      raise exception 'unsupported schedule kind';
  end case;

  if required_permission <> all(current_permissions) then
    raise exception 'not allowed';
  end if;

  if target_year is null or target_month is null then
    raise exception 'schedule period not found';
  end if;

  if target_status <> 'published' then
    raise exception 'schedule is not published';
  end if;

  notification_body := concat(
    'פורסם לוח לחודש ',
    lpad(target_month::text, 2, '0'),
    '/',
    target_year,
    '. ניתן לצפות בשיבוץ המעודכן במערכת.'
  );

  insert into public.notifications (
    type,
    priority,
    source,
    title,
    body,
    url,
    data,
    created_by
  )
  values (
    'schedule_published',
    'important',
    concat(requested_schedule_kind, '_schedule_publish'),
    notification_title,
    notification_body,
    notification_url,
    jsonb_build_object(
      'scheduleKind', requested_schedule_kind,
      'periodId', requested_period_id,
      'year', target_year,
      'month', target_month
    ),
    current_user_id
  )
  returning id into notification_id;

  insert into public.notification_recipients (
    notification_id,
    user_id
  )
  select
    notification_id,
    profile.id
  from public.profiles profile
  where profile.is_active = true
    and profile.role::text = recipient_role;

  get diagnostics recipient_count = row_count;

  if recipient_count = 0 then
    delete from public.notifications
    where id = notification_id;

    return jsonb_build_object(
      'notificationId', null,
      'recipientCount', 0
    );
  end if;

  return jsonb_build_object(
    'notificationId', notification_id,
    'recipientCount', recipient_count
  );
end;
$function$;
