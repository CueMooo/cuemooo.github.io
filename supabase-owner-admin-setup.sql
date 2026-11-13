-- CueMoo owner and moderation permissions. Safe to re-run.
create or replace function public.cuemoo_is_owner()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.chat_profiles where id=auth.uid() and role='owner' and is_banned=false) $$;
create or replace function public.cuemoo_is_moderator()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.chat_profiles where id=auth.uid() and role in ('owner','moderator') and is_banned=false) $$;

drop policy if exists "Owner can update member moderation" on public.chat_profiles;
create policy "Owner can update member moderation" on public.chat_profiles for update to authenticated
using(public.cuemoo_is_owner()) with check(public.cuemoo_is_owner());
drop policy if exists "Owner can read all member profiles" on public.chat_profiles;
create policy "Owner can read all member profiles" on public.chat_profiles for select to authenticated using(public.cuemoo_is_owner());

drop policy if exists "Moderators can remove global chat messages" on public.chat_messages;
create policy "Moderators can remove global chat messages" on public.chat_messages for delete to authenticated using(public.cuemoo_is_moderator());
drop policy if exists "Players can send as themselves" on public.chat_messages;
create policy "Players can send as themselves" on public.chat_messages for insert to authenticated with check(
 auth.uid()=user_id and exists(select 1 from public.chat_profiles p where p.id=auth.uid() and p.username=username and p.is_banned=false)
);


-- Keep banned users signed in, but reject all new chat and DM sends at the database.
drop policy if exists "Friends can send DMs" on public.direct_messages;
create policy "Friends can send DMs" on public.direct_messages
for insert to authenticated
with check(
 sender_id=auth.uid()
 and public.are_cuemoo_friends(sender_id,receiver_id)
 and exists(select 1 from public.chat_profiles p where p.id=auth.uid() and p.is_banned=false)
);

drop policy if exists "Users can remove own friendship" on public.friend_requests;
create policy "Users can remove own friendship" on public.friend_requests
for delete to authenticated
using(
 (sender_id=auth.uid() or receiver_id=auth.uid())
 and status='accepted'
);

create or replace function public.cuemoo_enforce_chat_cooldown()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
 actor uuid;
 previous_send timestamptz;
 wait_seconds integer;
 cooldown_seconds integer;
begin
 if tg_table_name='chat_messages' then
  actor:=new.user_id;
  cooldown_seconds:=30;
  if actor<>auth.uid() then raise exception 'Invalid chat sender'; end if;
  perform pg_advisory_xact_lock(hashtextextended('global:'||actor::text,0));
  if not exists(select 1 from public.chat_profiles p where p.id=actor and p.is_banned=false) then
   raise exception 'BANNED: this account cannot send chat messages';
  end if;
  select max(created_at) into previous_send from public.chat_messages where user_id=actor;
 else
  actor:=new.sender_id;
  cooldown_seconds:=15;
  if actor<>auth.uid() then raise exception 'Invalid message sender'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dm:'||actor::text,0));
  if not exists(select 1 from public.chat_profiles p where p.id=actor and p.is_banned=false) then
   raise exception 'BANNED: this account cannot send private messages';
  end if;
  select max(created_at) into previous_send from public.direct_messages where sender_id=actor;
 end if;
 if previous_send is not null and previous_send>now()-make_interval(secs=>cooldown_seconds) then
  wait_seconds:=ceil(extract(epoch from (previous_send+make_interval(secs=>cooldown_seconds)-now())))::integer;
  raise exception 'Cooldown: wait % more seconds before sending again',greatest(wait_seconds,1);
 end if;
 return new;
end;
$$;

drop trigger if exists cuemoo_global_chat_cooldown on public.chat_messages;
create trigger cuemoo_global_chat_cooldown
before insert on public.chat_messages
for each row execute function public.cuemoo_enforce_chat_cooldown();

drop trigger if exists cuemoo_private_message_cooldown on public.direct_messages;
create trigger cuemoo_private_message_cooldown
before insert on public.direct_messages
for each row execute function public.cuemoo_enforce_chat_cooldown();

-- Allow a currently signed-in member to receive an immediate ban/unban update.
do $$
begin
 alter publication supabase_realtime add table public.chat_profiles;
exception when duplicate_object then null;
end $$;


-- EMERGENCY RESET: clear accidental bans for every existing member.
-- Keep the designated CueMoo owner account as owner.
update public.chat_profiles
set is_banned = false;

update public.chat_profiles
set role = 'owner'
where lower(username) = 'cuemo';

-- Verify the reset and owner assignment.
select username, role, is_banned
from public.chat_profiles
order by username;
