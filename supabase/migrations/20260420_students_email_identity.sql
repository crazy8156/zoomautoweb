-- Normalize existing student emails so the application can safely use email
-- as the canonical business identifier across auth, student center, and Zoom mappings.
update public.students
set email = lower(trim(email))
where email is not null
  and email <> lower(trim(email));

-- Reject empty emails and make the column required.
update public.students
set email = null
where trim(coalesce(email, '')) = '';

alter table public.students
alter column email set not null;

-- Enforce one student per normalized email address.
create unique index if not exists students_email_normalized_unique
on public.students ((lower(trim(email))));
