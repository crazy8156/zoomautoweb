create table if not exists public.zoom_meeting_invitees (
  id uuid primary key default gen_random_uuid(),
  zoom_meeting_id text not null,
  email text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists zoom_meeting_invitees_meeting_email_unique
on public.zoom_meeting_invitees (zoom_meeting_id, email);

create index if not exists zoom_meeting_invitees_meeting_idx
on public.zoom_meeting_invitees (zoom_meeting_id);

update public.zoom_meeting_invitees
set email = lower(trim(email))
where email <> lower(trim(email));
