create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_course_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_count integer not null default 0 check (lesson_count >= 0),
  remaining_lessons integer not null default 0 check (remaining_lessons >= 0),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  session_id uuid references public.course_sessions(id) on delete set null,
  amount numeric(10, 2) not null default 0,
  currency text not null default 'TWD',
  source text not null default 'website',
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  status text not null default 'pending',
  amount numeric(10, 2) not null default 0,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists students_email_idx on public.students(email);
create index if not exists enrollments_student_idx on public.student_course_enrollments(student_id);
create index if not exists enrollments_course_idx on public.student_course_enrollments(course_id);
create index if not exists orders_student_idx on public.orders(student_id);
create index if not exists orders_course_idx on public.orders(course_id);
create index if not exists orders_session_idx on public.orders(session_id);
create index if not exists payments_order_idx on public.payments(order_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_students_updated_at on public.students;
create trigger set_students_updated_at
before update on public.students
for each row execute function public.set_updated_at();

drop trigger if exists set_student_course_enrollments_updated_at on public.student_course_enrollments;
create trigger set_student_course_enrollments_updated_at
before update on public.student_course_enrollments
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();
