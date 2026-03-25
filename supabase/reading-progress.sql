-- Reading progress per user and novel, used for resume/continue reading UX

create table if not exists public.reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  novel_id uuid not null references public.novels(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  chapter_number integer not null,
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  last_read_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, novel_id)
);

create index if not exists idx_reading_progress_user_last_read
  on public.reading_progress(user_id, last_read_at desc);

create index if not exists idx_reading_progress_novel
  on public.reading_progress(novel_id);

alter table public.reading_progress enable row level security;

-- Users can only manage their own reading progress rows
drop policy if exists reading_progress_select_own on public.reading_progress;
create policy reading_progress_select_own
  on public.reading_progress
  for select
  using (auth.uid() = user_id);

drop policy if exists reading_progress_insert_own on public.reading_progress;
create policy reading_progress_insert_own
  on public.reading_progress
  for insert
  with check (auth.uid() = user_id);

drop policy if exists reading_progress_update_own on public.reading_progress;
create policy reading_progress_update_own
  on public.reading_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists reading_progress_delete_own on public.reading_progress;
create policy reading_progress_delete_own
  on public.reading_progress
  for delete
  using (auth.uid() = user_id);

-- Keep updated_at fresh on updates
create or replace function public.tg_set_reading_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_reading_progress_updated_at on public.reading_progress;
create trigger trg_reading_progress_updated_at
before update on public.reading_progress
for each row execute function public.tg_set_reading_progress_updated_at();
