-- Exam Cracker — enrollment system upgrade
-- ---------------------------------------------------------------------------
-- Adds a durable, auditable enrollment model on top of the existing
-- `enrollments` table used by the content API.
--
-- Design notes
--   * The original `active` boolean is preserved for backwards compatibility.
--     `status` and `active` are kept in sync by a trigger.
--   * One row per (student, item_type, item_id) is enforced with a unique
--     index. Re-granting access reuses the row and writes an audit event.
--   * Revoking is a soft action. No student access row is ever hard-deleted by
--     admin bulk actions, so accidental mass deletion cannot erase history.
--   * `enrollment_rules` powers the optional "all current and future eligible
--     students" audience. New students are matched when they finish onboarding.
--   * All tables are service-role only. RLS is enabled with no policies,
--     matching the existing architecture where the Edge Function verifies the
--     Firebase ID token and talks to Postgres with the service key.
--
-- This migration is idempotent and safe to re-run. Existing duplicate rows are
-- archived into `enrollment_events` before the unique index is created.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Enrollment columns
-- ---------------------------------------------------------------------------
alter table public.enrollments add column if not exists status text;
alter table public.enrollments add column if not exists source text;
alter table public.enrollments add column if not exists granted_by text;
alter table public.enrollments add column if not exists revoked_at timestamptz;
alter table public.enrollments add column if not exists expires_at timestamptz;
alter table public.enrollments add column if not exists updated_at timestamptz;
alter table public.enrollments add column if not exists metadata jsonb;

update public.enrollments
set status = case when active is true then 'active' else 'revoked' end
where status is null;

update public.enrollments
set source = 'manual'
where source is null;

update public.enrollments
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.enrollments
set metadata = '{}'::jsonb
where metadata is null;

-- Leave status unset on insert so the trigger can derive it from legacy `active`.
-- A DEFAULT 'active' would silently reactivate rows inserted with active=false.
alter table public.enrollments alter column status drop default;
alter table public.enrollments alter column source set default 'manual';
alter table public.enrollments alter column metadata set default '{}'::jsonb;
alter table public.enrollments alter column status set not null;
alter table public.enrollments alter column source set not null;
alter table public.enrollments alter column metadata set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'enrollments_status_check') then
    alter table public.enrollments
      add constraint enrollments_status_check
      check (status in ('active', 'revoked', 'expired'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'enrollments_source_check') then
    alter table public.enrollments
      add constraint enrollments_source_check
      check (source in ('manual', 'admin_bulk', 'auto_rule', 'access_code', 'self_service', 'import'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Enrollment audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.enrollment_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid,
  firebase_uid text not null,
  item_type text not null,
  item_id uuid not null,
  action text not null check (action in (
    'granted', 'reactivated', 'revoked', 'auto_enrolled', 'deduplicated', 'expired'
  )),
  source text not null default 'manual',
  actor_uid text not null default '',
  actor_email text not null default '',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists enrollment_events_created_idx
  on public.enrollment_events (created_at desc);
create index if not exists enrollment_events_item_idx
  on public.enrollment_events (item_type, item_id, created_at desc);
create index if not exists enrollment_events_student_idx
  on public.enrollment_events (firebase_uid, created_at desc);

alter table public.enrollment_events enable row level security;
revoke all on table public.enrollment_events from anon, authenticated;

-- Archive duplicate rows before the unique index is applied. The keeper is the
-- active row, then the most recently updated row. No history is lost.
with ranked as (
  select
    id,
    firebase_uid,
    item_type,
    item_id,
    active,
    created_at,
    row_number() over (
      partition by firebase_uid, item_type, item_id
      order by (active is true) desc,
               coalesce(updated_at, created_at, now()) desc,
               coalesce(created_at, now()) desc,
               id
    ) as rn
  from public.enrollments
)
insert into public.enrollment_events
  (enrollment_id, firebase_uid, item_type, item_id, action, source, detail)
select
  id, firebase_uid, item_type, item_id, 'deduplicated', 'import',
  jsonb_build_object('reason', 'duplicate enrollment collapsed during unique-index migration')
from ranked
where rn > 1;

with ranked as (
  select
    id,
    row_number() over (
      partition by firebase_uid, item_type, item_id
      order by (active is true) desc,
               coalesce(updated_at, created_at, now()) desc,
               coalesce(created_at, now()) desc,
               id
    ) as rn
  from public.enrollments
)
delete from public.enrollments
where id in (select id from ranked where rn > 1);

create unique index if not exists enrollments_member_item_unique_idx
  on public.enrollments (firebase_uid, item_type, item_id);

create index if not exists enrollments_item_status_idx
  on public.enrollments (item_type, item_id, status);
create index if not exists enrollments_uid_status_idx
  on public.enrollments (firebase_uid, status, expires_at);

-- Keep `active`, `status`, `revoked_at` and `updated_at` consistent no matter
-- which client (legacy admin panel, new console or Edge Function) writes.
create or replace function public.ec_sync_enrollment_state()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is null then
      new.status := case when new.active is false then 'revoked' else 'active' end;
    end if;
    if new.active is null then
      new.active := new.status = 'active';
    end if;
  end if;

  if new.status = 'revoked' then
    new.active := false;
    new.revoked_at := coalesce(new.revoked_at, now());
  elsif new.status = 'active' then
    new.active := true;
    new.revoked_at := null;
  end if;

  if tg_op = 'UPDATE' and new.active is distinct from old.active then
    if new.active is true and new.status <> 'active' then
      new.status := 'active';
      new.revoked_at := null;
    elsif new.active is false and new.status = 'active' then
      new.status := 'revoked';
      new.revoked_at := coalesce(new.revoked_at, now());
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ec_sync_enrollment_state on public.enrollments;
create trigger ec_sync_enrollment_state
  before insert or update on public.enrollments
  for each row execute function public.ec_sync_enrollment_state();

-- ---------------------------------------------------------------------------
-- 3. Audience rules for current + future students
-- ---------------------------------------------------------------------------
create table if not exists public.enrollment_rules (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('batch', 'series')),
  item_id uuid not null,
  name text not null default '',
  include_future boolean not null default true,
  respect_eligibility boolean not null default true,
  filter_exam text not null default '' check (filter_exam in ('', 'JEE', 'NEET')),
  filter_class text not null default '' check (filter_class in ('', '11', '12')),
  expires_at timestamptz,
  active boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_applied_at timestamptz,
  last_applied_count integer not null default 0,
  unique (item_type, item_id)
);

create index if not exists enrollment_rules_active_idx
  on public.enrollment_rules (active, include_future);

alter table public.enrollment_rules enable row level security;
revoke all on table public.enrollment_rules from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Query indexes used by the admin console and onboarding auto-enrollment
-- ---------------------------------------------------------------------------
create index if not exists student_profiles_exam_class_idx
  on public.student_profiles (exam, class_level);
create index if not exists student_profiles_created_idx
  on public.student_profiles (created_at desc);

comment on table public.enrollment_events is
  'Immutable audit trail for enrollment grants, reactivations, revocations and auto-enrollments.';
comment on table public.enrollment_rules is
  'Optional auto-enrollment rules applied to newly onboarded eligible students.';
