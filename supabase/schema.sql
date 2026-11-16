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
