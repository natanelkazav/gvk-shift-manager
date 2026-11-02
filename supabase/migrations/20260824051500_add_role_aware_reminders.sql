-- קובץ: supabase/migrations/20260824051500_add_role_aware_reminders.sql
-- מטרה: הגדרת פעולות מסד נתונים עבור תזכורות.
-- מטרות עיקריות:
-- - מבני טבלאות: public.notification_preferences, public.scheduled_reminder_deliveries.
-- - סדר הפקודות, התנאים וההרשאות בקובץ נשמר כפי שהיה במקור.
-- עדכון מבנה או הגדרות הטבלה public.notification_preferences.
alter table public.notification_preferences
  add column if not exists driver_duty_reminders_enabled boolean not null default false,
  add column if not exists driver_duty_reminder_time time without time zone not null default '09:00';

-- הגדרת מבנה הטבלה public.scheduled_reminder_deliveries והאילוצים המופיעים בהמשך.
create table if not exists public.scheduled_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_type text not null check (
    reminder_type in ('morning_driver_shift', 'driver_duty_day')
  ),
  reminder_key text not null,
  source_id uuid,
  notification_id uuid references public.notifications(id) on delete set null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, reminder_type, reminder_key)
);

-- הגדרת האינדקס scheduled_reminder_deliveries_user_idx עבור העמודות והתנאים המפורטים בפקודה.
create index if not exists scheduled_reminder_deliveries_user_idx
  on public.scheduled_reminder_deliveries(user_id, created_at desc);

-- עדכון מבנה או הגדרות הטבלה public.scheduled_reminder_deliveries.
alter table public.scheduled_reminder_deliveries enable row level security;
