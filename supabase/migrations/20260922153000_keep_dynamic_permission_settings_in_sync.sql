-- קובץ: supabase/migrations/20260922153000_keep_dynamic_permission_settings_in_sync.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור דינמי / הרשאות / הגדרות.
-- מטרות עיקריות:
-- - הגדרת פונקציות: public.sync_dynamic_job_type_permission_settings, public.trg_sync_job_types_for_permission_manifest.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
begin;

-- Keep role-level permission settings complete when new permissions are added
-- to an already-active feature. Existing rows are never overwritten here, so
-- explicit choices made in the permission editor remain authoritative.
-- פונקציית מסד public.sync_dynamic_job_type_permission_settings: סנכרון סוג תפקיד.
create or replace function public.sync_dynamic_job_type_permission_settings(requested_job_type_id uuid)
returns void
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = public
as $$
declare
  features text[];
begin
  features := public.get_dynamic_job_type_active_features(requested_job_type_id);

  -- מחיקת הרשומות שנבחרו מתוך public.job_type_permission_settings בהתאם לקלט ולתנאים להלן.
  delete from public.job_type_permission_settings s
  where s.job_type_id = requested_job_type_id
    and not exists (
      select 1
      from public.dynamic_permission_manifest m
      where m.permission_key = s.permission_key
        and m.audience = s.audience
        and m.feature_key = any(features)
    );

  -- הוספת רשומות ל־public.job_type_permission_settings בהתאם לקלט ולתנאים להלן.
  insert into public.job_type_permission_settings
    (job_type_id, permission_key, audience, enabled, source, updated_at)
  select requested_job_type_id, m.permission_key, m.audience,
         m.default_enabled, 'manifest', now()
  from public.dynamic_permission_manifest m
  where m.feature_key = any(features)
  on conflict (job_type_id, permission_key, audience) do nothing;
end;
$$;

-- When the manifest grows, immediately materialize the new permission for all
-- job types that currently expose that feature. This closes the gap where a
-- later migration adds a permission but existing roles never receive a row.
-- פונקציית מסד public.trg_sync_job_types_for_permission_manifest: סוגי תפקידים.
create or replace function public.trg_sync_job_types_for_permission_manifest()
returns trigger
language plpgsql
-- הפונקציה רצה בהרשאות הבעלים; בדיקות הרשאה פנימיות והרשאות EXECUTE נבחנות בנפרד.
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
  for r in select id from public.job_types loop
    perform public.sync_dynamic_job_type_permission_settings(r.id);
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_dynamic_permission_manifest_sync on public.dynamic_permission_manifest;
create trigger trg_dynamic_permission_manifest_sync
after insert or update of feature_key, permission_key, audience, default_enabled
on public.dynamic_permission_manifest
for each statement execute function public.trg_sync_job_types_for_permission_manifest();

-- Backfill permissions added after the original role-permission materialization
-- (including attendance.edit_team / attendance.edit_archived).
do $$
declare r record;
begin
  -- מעבר על תוצאות השאילתה או האוסף ועיבוד כל רשומה בנפרד.
  for r in select id from public.job_types loop
    perform public.sync_dynamic_job_type_permission_settings(r.id);
  end loop;
end $$;

-- Repair only untouched manifest-origin attendance defaults. Never overwrite a
-- role_builder value because that represents an explicit manager choice.
-- עדכון רשומות ב־public.job_type_permission_settings בהתאם לקלט ולתנאים להלן.
update public.job_type_permission_settings s
set enabled = m.default_enabled,
    updated_at = now()
from public.dynamic_permission_manifest m
where s.permission_key = m.permission_key
  and s.audience = m.audience
  and s.source = 'manifest'
  and m.feature_key = 'attendance'
  and s.enabled is distinct from m.default_enabled
  and exists (
    select 1
    from public.job_types jt
    where jt.id = s.job_type_id
      and m.feature_key = any(public.get_dynamic_job_type_active_features(jt.id))
  );

commit;
