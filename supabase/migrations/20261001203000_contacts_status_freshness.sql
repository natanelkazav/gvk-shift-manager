-- Contact status freshness is calculated at read time.
-- New/updated are attention states for 7 days; needs_review stays until the record is corrected.
create or replace function public.get_contacts_directory(requested_client_id uuid default null)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select case
    when not public.contact_has_permission('contacts.view') then '[]'::jsonb
    else coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',r.id,
          'client_id',r.client_id,
          'client_name',c.name,
          'branch_name',r.branch_name,
          'role_name',r.role_name,
          'full_name',r.full_name,
          'phone',r.phone,
          'email',r.email,
          'change_status',case
            when r.change_status='needs_review' then 'needs_review'
            when r.change_status in ('new','updated') and r.updated_at >= now()-interval '7 days' then r.change_status
            else 'current'
          end,
          'is_active',r.is_active,
          'updated_at',r.updated_at
        )
        order by c.name,r.branch_name,r.role_name
      ),
      '[]'::jsonb
    )
  end
  from public.contact_records r
  join public.contact_clients c on c.id=r.client_id
  where r.is_active
    and (requested_client_id is null or r.client_id=requested_client_id)
$$;

create or replace function public.get_recent_contact_changes()
returns jsonb
language sql
security definer
set search_path=''
as $$
  select case
    when not public.contact_has_permission('contacts.changes_view') then '[]'::jsonb
    else coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',x.id,
          'client_name',c.name,
          'branch_name',x.branch_name,
          'role_name',x.role_name,
          'full_name',x.full_name,
          'change_type',x.change_type,
          'created_at',x.created_at
        )
        order by
          case when x.change_type='needs_review' then 0 else 1 end,
          x.created_at desc
      ),
      '[]'::jsonb
    )
  end
  from (
    select ch.*
    from public.contact_changes ch
    left join public.contact_records r on r.id=ch.contact_id
    where
      (
        ch.change_type='needs_review'
        and r.is_active
        and r.change_status='needs_review'
      )
      or
      (
        ch.change_type in ('new','updated')
        and ch.created_at >= now()-interval '7 days'
      )
    order by
      case when ch.change_type='needs_review' then 0 else 1 end,
      ch.created_at desc
    limit 30
  ) x
  join public.contact_clients c on c.id=x.client_id
$$;

grant execute on function public.get_contacts_directory(uuid), public.get_recent_contact_changes() to authenticated;
