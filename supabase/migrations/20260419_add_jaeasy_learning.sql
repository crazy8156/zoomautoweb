create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'jaeasy_jlpt_level'
  ) then
    create type public.jaeasy_jlpt_level as enum ('N5', 'N4', 'N3', 'N2', 'N1');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'jaeasy_quiz_type'
  ) then
    create type public.jaeasy_quiz_type as enum ('vocab', 'grammar', 'reading');
  end if;
end
$$;

create table if not exists public.jaeasy_vocabulary (
  id bigint primary key,
  word text not null,
  reading text not null,
  meaning_zh text not null,
  pos text not null default '',
  jlpt_level public.jaeasy_jlpt_level not null,
  audio_url text,
  example_ja text not null default '',
  example_zh text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (word, reading)
);

create table if not exists public.jaeasy_user_vocab_srs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vocab_id bigint not null references public.jaeasy_vocabulary(id) on delete cascade,
  interval_days numeric(8, 2) not null default 1,
  ease_factor numeric(8, 3) not null default 2.5,
  repetitions integer not null default 0 check (repetitions >= 0),
  last_grade integer not null default 0 check (last_grade between 0 and 5),
  next_review_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, vocab_id)
);

create table if not exists public.jaeasy_quiz_questions (
  id text primary key,
  type public.jaeasy_quiz_type not null,
  jlpt_level public.jaeasy_jlpt_level not null,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  answer_index integer not null check (answer_index >= 0),
  explanation text,
  created_at timestamptz not null default now()
);

create table if not exists public.jaeasy_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null references public.jaeasy_quiz_questions(id) on delete cascade,
  quiz_type public.jaeasy_quiz_type not null,
  jlpt_level public.jaeasy_jlpt_level not null,
  question_snapshot text not null,
  selected_index integer not null check (selected_index >= 0),
  selected_label text,
  correct_index integer not null check (correct_index >= 0),
  correct_label text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now()
);

create index if not exists jaeasy_vocabulary_level_idx on public.jaeasy_vocabulary(jlpt_level);
create index if not exists jaeasy_user_vocab_srs_user_idx on public.jaeasy_user_vocab_srs(user_id);
create index if not exists jaeasy_user_vocab_srs_due_idx on public.jaeasy_user_vocab_srs(user_id, next_review_at);
create index if not exists jaeasy_quiz_questions_lookup_idx on public.jaeasy_quiz_questions(jlpt_level, type);
create index if not exists jaeasy_quiz_attempts_user_idx on public.jaeasy_quiz_attempts(user_id, answered_at desc);

create or replace function public.set_jaeasy_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_jaeasy_vocabulary_updated_at on public.jaeasy_vocabulary;
create trigger set_jaeasy_vocabulary_updated_at
before update on public.jaeasy_vocabulary
for each row execute function public.set_jaeasy_updated_at();

drop trigger if exists set_jaeasy_user_vocab_srs_updated_at on public.jaeasy_user_vocab_srs;
create trigger set_jaeasy_user_vocab_srs_updated_at
before update on public.jaeasy_user_vocab_srs
for each row execute function public.set_jaeasy_updated_at();

alter table public.jaeasy_vocabulary enable row level security;
alter table public.jaeasy_user_vocab_srs enable row level security;
alter table public.jaeasy_quiz_questions enable row level security;
alter table public.jaeasy_quiz_attempts enable row level security;

drop policy if exists "jaeasy vocab read" on public.jaeasy_vocabulary;
create policy "jaeasy vocab read"
on public.jaeasy_vocabulary
for select
using (true);

drop policy if exists "jaeasy quiz question read" on public.jaeasy_quiz_questions;
create policy "jaeasy quiz question read"
on public.jaeasy_quiz_questions
for select
using (true);

drop policy if exists "jaeasy own srs read" on public.jaeasy_user_vocab_srs;
create policy "jaeasy own srs read"
on public.jaeasy_user_vocab_srs
for select
using (auth.uid() = user_id);

drop policy if exists "jaeasy own srs write" on public.jaeasy_user_vocab_srs;
create policy "jaeasy own srs write"
on public.jaeasy_user_vocab_srs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "jaeasy own quiz attempts read" on public.jaeasy_quiz_attempts;
create policy "jaeasy own quiz attempts read"
on public.jaeasy_quiz_attempts
for select
using (auth.uid() = user_id);

drop policy if exists "jaeasy own quiz attempts write" on public.jaeasy_quiz_attempts;
create policy "jaeasy own quiz attempts write"
on public.jaeasy_quiz_attempts
for insert
with check (auth.uid() = user_id);
