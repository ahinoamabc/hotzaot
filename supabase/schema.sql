-- מעקב הוצאות: הטבלאות ב-Supabase
-- מריצים פעם אחת: Supabase > SQL Editor > New query > מדביקים את כל הקובץ > Run

-- הוצאות. amount = הסכום המלא ששילמתי, my_share = החלק שלי (מה שנספר בתקציב)
create table if not exists expenses (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  date       date not null,
  amount     numeric(10,2) not null check (amount >= 0),
  my_share   numeric(10,2) not null check (my_share >= 0),
  category   text not null,
  payment    text not null,
  shared     boolean not null default false,
  note       text,
  source     text not null default 'manual',   -- manual | fixed
  deleted    boolean not null default false,   -- מחיקה רכה, כדי שהסנכרון בין מכשירים יעבוד
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- הכנסות (שייכות לחודש שבו הכסף נכנס בפועל)
create table if not exists incomes (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  date       date not null,
  amount     numeric(10,2) not null check (amount >= 0),
  source     text not null,          -- unemployment | elections | salary | other
  note       text,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table incomes enable row level security;
drop policy if exists own_rows on incomes;
create policy own_rows on incomes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- התחשבנויות עם השותפות (למשל ביט שהתקבל). לא הכנסה ולא הוצאה
create table if not exists settlements (
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  id         text not null,
  date       date not null,
  amount     numeric(10,2) not null,
  note       text,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- הגדרות: יתרת עו"ש, חיוב אשראי צפוי, הוצאות קבועות, תקציבים
create table if not exists settings (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- כל משתמשת רואה ועורכת רק את השורות שלה
alter table expenses    enable row level security;
alter table settlements enable row level security;
alter table settings    enable row level security;

drop policy if exists own_rows on expenses;
drop policy if exists own_rows on settlements;
drop policy if exists own_rows on settings;

create policy own_rows on expenses    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on settlements for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on settings    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- תזכורת ערב (התראות Push) ----------
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- הטלפונים שנרשמו להתראות
create table if not exists push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
create policy own_rows on push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- סודות של השרת: vapid_public, vapid_private_jwk, cron_secret, reminder_hour.
-- רק ה-service role קורא אותם. הערכים עצמם לא נמצאים בקובץ הזה.
create table if not exists push_config (key text primary key, value text not null);
alter table push_config enable row level security;
revoke all on push_config from anon, authenticated;

-- כל יום ב-18:00 וב-19:00 UTC; הפונקציה שולחת רק כשבירושלים 21:00 (קיץ וחורף)
-- select cron.schedule('daily-reminder', '0 18,19 * * *', $$ select net.http_post(
--   url := 'https://czxvgptljyxkeafucvco.supabase.co/functions/v1/daily-reminder',
--   headers := jsonb_build_object('Content-Type','application/json',
--     'x-cron-secret', (select value from public.push_config where key = 'cron_secret')),
--   body := '{}'::jsonb) $$);
