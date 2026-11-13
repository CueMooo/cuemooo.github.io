-- Run this in Supabase Dashboard > SQL Editor.
-- This replaces the previous anonymous-chat setup.
create table if not exists public.chat_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists chat_profiles_username_unique
  on public.chat_profiles (lower(username));

create or replace function public.create_chat_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.chat_profiles (id, username)
  values (new.id, lower(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;

drop trigger if exists on_chat_user_created on auth.users;
create trigger on_chat_user_created
after insert on auth.users
for each row execute procedure public.create_chat_profile();

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 3 and 20),
  content text not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);
create table if not exists public.chat_reports (
  id bigint generated always as identity primary key,
  message_id bigint not null references public.chat_messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

alter table public.chat_profiles enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reports enable row level security;

drop policy if exists "Players can read chat profiles" on public.chat_profiles;
create policy "Players can read chat profiles" on public.chat_profiles
for select to authenticated using (true);

drop policy if exists "Authenticated players can read chat" on public.chat_messages;
create policy "Authenticated players can read chat" on public.chat_messages
for select to authenticated using (true);

drop policy if exists "Players can send as themselves" on public.chat_messages;
create policy "Players can send as themselves" on public.chat_messages
for insert to authenticated with check (
  auth.uid() = user_id and exists (
    select 1 from public.chat_profiles p
    where p.id = auth.uid() and p.username = username
  )
);

drop policy if exists "Players can report messages" on public.chat_reports;
create policy "Players can report messages" on public.chat_reports
for insert to authenticated with check (auth.uid() = reporter_id);

-- Enforce a server-side cooldown per signed-in account.
create or replace function public.enforce_chat_cooldown()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.chat_messages
    where user_id = new.user_id and created_at > now() - interval '3 seconds'
  ) then
    raise exception 'Please wait before sending another message';
  end if;
  return new;
end;
$$;
drop trigger if exists chat_message_cooldown on public.chat_messages;
create trigger chat_message_cooldown before insert on public.chat_messages
for each row execute function public.enforce_chat_cooldown();

-- Add chat messages to Supabase Realtime (ignore if already added).
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;