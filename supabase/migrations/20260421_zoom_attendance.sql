create table if not exists public.zoom_webhook_events (
  id uuid primary key default gen_random_uuid(),
  zoom_event text not null,
  zoom_event_id text null,
  zoom_meeting_id text null,
  session_id uuid null,
  payload jsonb not null,
  received_at timestamptz not null default timezone('utc', now())
);

create index if not exists zoom_webhook_events_event_idx
on public.zoom_webhook_events (zoom_event, received_at desc);

create index if not exists zoom_webhook_events_meeting_idx
on public.zoom_webhook_events (zoom_meeting_id);

create table if not exists public.zoom_session_attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid null,
  course_id uuid null,
  zoom_meeting_id text not null,
  participant_key text not null,
  student_id uuid null,
  email text null,
  participant_name text null,
  zoom_participant_id text null,
  join_time timestamptz null,
  leave_time timestamptz null,
  duration_minutes integer not null default 0,
  attendance_status text not null default 'registered',
  auto_deducted_at timestamptz null,
  last_event_at timestamptz null,
  source text not null default 'zoom_webhook',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists zoom_session_attendance_session_participant_unique
on public.zoom_session_attendance (zoom_meeting_id, session_id, participant_key);

create index if not exists zoom_session_attendance_session_idx
on public.zoom_session_attendance (session_id);

create index if not exists zoom_session_attendance_student_idx
on public.zoom_session_attendance (student_id);

create index if not exists zoom_session_attendance_meeting_idx
on public.zoom_session_attendance (zoom_meeting_id);

update public.zoom_session_attendance
set email = lower(trim(email))
where email is not null and email <> lower(trim(email));
