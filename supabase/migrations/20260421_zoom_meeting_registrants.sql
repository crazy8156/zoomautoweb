create table if not exists public.zoom_meeting_registrants (
  id uuid primary key default gen_random_uuid(),
  zoom_meeting_id text not null,
  email text not null,
  student_id uuid null,
  first_name text null,
  last_name text null,
  zoom_registrant_id text null,
  join_url text null,
  status text not null default 'approved',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists zoom_meeting_registrants_meeting_email_unique
on public.zoom_meeting_registrants (zoom_meeting_id, email);

create index if not exists zoom_meeting_registrants_meeting_idx
on public.zoom_meeting_registrants (zoom_meeting_id);

create index if not exists zoom_meeting_registrants_student_idx
on public.zoom_meeting_registrants (student_id);

create index if not exists zoom_meeting_registrants_email_idx
on public.zoom_meeting_registrants (email);

update public.zoom_meeting_registrants
set email = lower(trim(email))
where email <> lower(trim(email));
