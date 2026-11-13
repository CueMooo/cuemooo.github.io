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
