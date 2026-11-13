-- Run once in Supabase Dashboard > SQL Editor.
create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 20),
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
alter table public.chat_messages enable row level security;
alter table public.chat_reports enable row level security;
drop policy if exists "Authenticated players can read chat" on public.chat_messages;
create policy "Authenticated players can read chat" on public.chat_messages
for select to authenticated using (true);
drop policy if exists "Players can send as themselves" on public.chat_messages;
create policy "Players can send as themselves" on public.chat_messages
for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Players can report messages" on public.chat_reports;
create policy "Players can report messages" on public.chat_reports
for insert to authenticated with check (auth.uid() = reporter_id);

-- Server-side 3-second cooldown per anonymous player.
create or replace function public.enforce_chat_cooldown()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.chat_messages
    where user_id = new.user_id and created_at > now() - interval '3 seconds') then
    raise exception 'Please wait before sending another message';
  end if;
  return new;
end;
$$;
drop trigger if exists chat_message_cooldown on public.chat_messages;
create trigger chat_message_cooldown before insert on public.chat_messages
for each row execute function public.enforce_chat_cooldown();

-- Add the table to Supabase Realtime (if not already included).
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null;
end $$;
