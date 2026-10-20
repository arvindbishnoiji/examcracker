-- Exam Cracker — admin-controlled site platform
-- ---------------------------------------------------------------------------
-- Adds persistent storage for the visual CMS, admin activity trail and the
-- per-student personal library (bookmarks, timestamp notes, recents,
-- challenge progress and revision plans).
--
-- All tables are service-role only. RLS is enabled with no policies, matching
-- the existing architecture where the Edge Function verifies the Firebase ID
-- token and then uses the service role key. Browser clients never read these
-- tables directly.

create extension if not exists pgcrypto;

-- Draft/published document store for admin-managed site configuration.
-- Keys: theme, login, homepage, navigation, footer, banners, popups,
--       testimonials, challenges, features, seo, media.
create table if not exists public.site_settings (
  key text primary key,
  draft jsonb not null default '{}'::jsonb,
  published jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text
);

comment on table public.site_settings is
  'Admin-controlled CMS documents. Service role only; public values are exposed through /public/site.';

alter table public.site_settings enable row level security;
revoke all on table public.site_settings from anon, authenticated;

-- Audit trail for admin actions (content, settings, broadcasts, enrollments).
create table if not exists public.admin_activity (
  id uuid primary key default gen_random_uuid(),
  actor_uid text not null default '',
  actor_email text not null default '',
  action text not null,
  target_type text not null default '',
  target_id text not null default '',
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_created_at_idx
  on public.admin_activity (created_at desc);

alter table public.admin_activity enable row level security;
revoke all on table public.admin_activity from anon, authenticated;

-- Personal library: bookmarks, notes, recently viewed, challenge progress.
create table if not exists public.student_library (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,
  item_type text not null check (item_type in ('bookmark', 'note', 'recent', 'challenge', 'revision')),
  item_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firebase_uid, item_type, item_id)
);

create index if not exists student_library_uid_idx
  on public.student_library (firebase_uid, updated_at desc);

alter table public.student_library enable row level security;
revoke all on table public.student_library from anon, authenticated;

-- Helpful lookup indexes for admin analytics.
create index if not exists exam_attempts_submitted_at_idx
  on public.exam_attempts (submitted_at desc);
create index if not exists enrollments_item_idx
  on public.enrollments (item_type, item_id);
