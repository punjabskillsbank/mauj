-- =============================================================================
-- Mauj — Database Schema
-- Run this entire file once in the Supabase Dashboard SQL Editor.
-- It is safe to read top-to-bottom: extensions -> tables -> indexes ->
-- functions/triggers -> Row Level Security policies -> seed data -> realtime.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- gen_random_uuid() lives in pgcrypto. Supabase usually has this enabled
-- already, but "if not exists" makes this script safe to re-run.
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------

-- One row per user (both admins and students). The id matches auth.users.id
-- exactly, so this table is a 1:1 extension of Supabase's built-in auth table.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null unique,
  role text not null check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

-- An admin creates one of these per student email before that student
-- can register. status flips from 'pending' to 'registered' automatically
-- the moment that student successfully signs up (see the trigger below).
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'registered')),
  created_at timestamptz not null default now()
);

-- The catalog of habits/tasks an admin wants students tracking.
-- is_active controls whether it currently shows up on students' daily log screen.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null check (type in ('boolean', 'duration')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per (student, task, date). completed is used for boolean tasks,
-- duration_minutes for duration tasks. The unique constraint means a
-- student can only have one log entry per task per day — your app screen
-- should "upsert" (insert-or-update) against this, not blindly insert.
create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  date date not null,
  completed boolean not null default false,
  duration_minutes int,
  created_at timestamptz not null default now(),
  unique (student_id, task_id, date)
);

-- -----------------------------------------------------------------------------
-- 2. INDEXES
-- Speed up the queries our screens will actually run.
-- -----------------------------------------------------------------------------
create index idx_daily_logs_student_date on public.daily_logs (student_id, date);
create index idx_daily_logs_task on public.daily_logs (task_id);
create index idx_invitations_email on public.invitations (email);
create index idx_tasks_active on public.tasks (is_active);

-- -----------------------------------------------------------------------------
-- 3. HELPER FUNCTION: is_admin()
-- Used inside RLS policies below. It's marked SECURITY DEFINER so it reads
-- the profiles table with elevated privileges, bypassing RLS. This is
-- required to avoid "infinite recursion" errors that happen if a profiles
-- RLS policy tried to query the profiles table directly.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. SIGNUP TRIGGER: public.handle_new_user()
-- Fires automatically every time a new row is inserted into Supabase's
-- built-in auth.users table (i.e. every time someone calls supabase.auth.signUp()).
--
-- - Reads role/first_name/last_name that our app sends as "metadata" during signUp.
-- - If role = 'student': requires a matching PENDING invitation to exist.
--   If none is found, it RAISES AN EXCEPTION, which aborts the entire
--   transaction — meaning the auth.users row itself is rolled back and
--   signUp() fails with an error your app can display. This is what makes
--   "strict registration" actually enforced on the server, not just the UI.
-- - If role = 'admin': no invitation required, profile is created directly.
-- - Either way, creates the matching row in public.profiles.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_first_name text;
  v_last_name text;
  v_invitation_id uuid;
begin
  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  v_first_name := new.raw_user_meta_data ->> 'first_name';
  v_last_name := new.raw_user_meta_data ->> 'last_name';

  if v_role = 'student' then
    select id into v_invitation_id
    from public.invitations
    where email = new.email
      and status = 'pending'
    limit 1;

    if v_invitation_id is null then
      raise exception
        'No pending invitation found for %. Ask your admin to invite this email first.',
        new.email;
    end if;

    update public.invitations
    set status = 'registered'
    where id = v_invitation_id;
  elsif v_role != 'admin' then
    raise exception 'Invalid role: %. Must be student or admin.', v_role;
  end if;

  insert into public.profiles (id, first_name, last_name, email, role)
  values (new.id, v_first_name, v_last_name, new.email, v_role);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- RLS is off by default in Postgres. Turning it on for a table means:
-- "deny everything unless a policy explicitly allows it." Each policy below
-- targets one operation (select/insert/update/delete) for one role, so it's
-- easy to reason about exactly who can do what.
-- -----------------------------------------------------------------------------

-- ---- profiles ----
alter table public.profiles enable row level security;

create policy "Users can view own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "Admins can view all profiles"
on public.profiles for select
to authenticated
using (public.is_admin());

create policy "Admins can update all profiles"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Note: there's intentionally no "insert" policy for regular users — profile
-- rows are only ever created by the handle_new_user() trigger, which runs
-- as SECURITY DEFINER and bypasses RLS entirely.

-- ---- invitations ----
alter table public.invitations enable row level security;

create policy "Admins can view all invitations"
on public.invitations for select
to authenticated
using (public.is_admin());

create policy "Students can view own invitation"
on public.invitations for select
to authenticated
using (email = (select email from public.profiles where id = auth.uid()));

create policy "Admins can create invitations"
on public.invitations for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update invitations"
on public.invitations for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete invitations"
on public.invitations for delete
to authenticated
using (public.is_admin());

-- ---- tasks ----
alter table public.tasks enable row level security;

create policy "Authenticated users can view active tasks"
on public.tasks for select
to authenticated
using (is_active = true);

create policy "Admins can view all tasks"
on public.tasks for select
to authenticated
using (public.is_admin());

create policy "Admins can create tasks"
on public.tasks for insert
to authenticated
with check (public.is_admin());

create policy "Admins can update tasks"
on public.tasks for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete tasks"
on public.tasks for delete
to authenticated
using (public.is_admin());

-- ---- daily_logs ----
alter table public.daily_logs enable row level security;

create policy "Students can view own logs"
on public.daily_logs for select
to authenticated
using (student_id = auth.uid());

create policy "Admins can view all logs"
on public.daily_logs for select
to authenticated
using (public.is_admin());

create policy "Students can insert own logs"
on public.daily_logs for insert
to authenticated
with check (student_id = auth.uid());

create policy "Students can update own logs"
on public.daily_logs for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "Admins can modify all logs"
on public.daily_logs for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. SEED DATA
-- A handful of starter habits so the app isn't empty on first run. Feel free
-- to add/remove more later from the Admin dashboard's Habit Management tab —
-- that's exactly what it's for.
-- -----------------------------------------------------------------------------
insert into public.tasks (title, type, is_active) values
  ('Drink 8 glasses of water', 'boolean', true),
  ('Read for 20 minutes', 'duration', true),
  ('Exercise', 'duration', true),
  ('Meditate', 'boolean', true),
  ('Sleep 8 hours', 'boolean', true);

-- -----------------------------------------------------------------------------
-- 7. REALTIME
-- Adds these tables to Supabase's realtime publication so the Admin's
-- Real-time Dashboard tab can subscribe to postgres_changes and get live
-- updates (new student registrations, new completed logs) over WebSockets.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.daily_logs;
alter publication supabase_realtime add table public.invitations;

-- -----------------------------------------------------------------------------
-- 8. PRE-SIGNUP INVITATION CHECK (anon-callable)
-- Supabase Auth wraps ANY error thrown by handle_new_user() in a generic
-- "Database error saving new user" message on the client, for security —
-- it never leaks our raw RAISE EXCEPTION text to the app. That trigger is
-- still the real enforcement (a client can't bypass it), but it makes for
-- a bad error message. This function lets the Sign Up screen check
-- *before* attempting signup, so it can show a friendly message instead.
--
-- It's callable by the "anon" role (logged-out users) since that's exactly
-- who's filling out the Sign Up form. It only returns a boolean — never the
-- underlying rows — so it can't be used to enumerate every invited email.
-- -----------------------------------------------------------------------------
create or replace function public.check_pending_invitation(check_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.invitations
    where email = check_email and status = 'pending'
  );
$$;

grant execute on function public.check_pending_invitation(text) to anon, authenticated;
