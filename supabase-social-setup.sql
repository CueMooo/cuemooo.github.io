-- CueMoo social features v2. Run once in Supabase SQL Editor.
-- Existing auth users and global chat messages are preserved.
alter table public.chat_profiles
  add column if not exists display_name text,
  add column if not exists bio text not null default '',
  add column if not exists avatar_url text,
  add column if not exists role text not null default 'member'
    check (role in ('member','moderator','owner')),
  add column if not exists is_banned boolean not null default false;

update public.chat_profiles set display_name=username where display_name is null;

-- Keep profile edits limited to safe public fields. Role/ban changes are owner-only below.
drop policy if exists "Players can update own profile" on public.chat_profiles;
drop policy if exists "Players can update own profile" on public.chat_profiles;
create policy "Players can update own profile" on public.chat_profiles
for update to authenticated using (id=auth.uid() and is_banned=false)
with check (id=auth.uid() and role='member' and is_banned=false);

create table if not exists public.friend_requests (
 id bigint generated always as identity primary key,
 sender_id uuid not null references auth.users(id) on delete cascade,
 receiver_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined','blocked')),
 created_at timestamptz not null default now(),
 unique(sender_id,receiver_id),
 check(sender_id<>receiver_id)
);
alter table public.friend_requests enable row level security;
drop policy if exists "Users can view own friend requests" on public.friend_requests;
drop policy if exists "Users can view own friend requests" on public.friend_requests;
create policy "Users can view own friend requests" on public.friend_requests
for select to authenticated using (sender_id=auth.uid() or receiver_id=auth.uid());
drop policy if exists "Users can send friend requests" on public.friend_requests;
drop policy if exists "Users can send friend requests" on public.friend_requests;
create policy "Users can send friend requests" on public.friend_requests
for insert to authenticated with check(sender_id=auth.uid() and receiver_id<>auth.uid() and status='pending');
drop policy if exists "Recipients can respond to requests" on public.friend_requests;
drop policy if exists "Recipients can respond to requests" on public.friend_requests;
create policy "Recipients can respond to requests" on public.friend_requests
for update to authenticated using (receiver_id=auth.uid() and status='pending')
with check (receiver_id=auth.uid() and status in ('accepted','declined','blocked'));

create table if not exists public.chat_groups (
 id bigint generated always as identity primary key,
 name text not null check(char_length(name) between 2 and 40),
 description text not null default '',
 created_by uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create table if not exists public.chat_group_members (
 group_id bigint not null references public.chat_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 member_role text not null default 'member' check(member_role in ('member','admin')),
 joined_at timestamptz not null default now(),
 primary key(group_id,user_id)
);
create table if not exists public.direct_messages (
 id bigint generated always as identity primary key,
 sender_id uuid not null references auth.users(id) on delete cascade,
 receiver_id uuid not null references auth.users(id) on delete cascade,
 content text not null check(char_length(content) between 1 and 1000),
 created_at timestamptz not null default now(),
 check(sender_id<>receiver_id)
);
create table if not exists public.group_messages (
 id bigint generated always as identity primary key,
 group_id bigint not null references public.chat_groups(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 content text not null check(char_length(content) between 1 and 1000),
 created_at timestamptz not null default now()
);
alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.direct_messages enable row level security;
alter table public.group_messages enable row level security;

-- Helper: only accepted friends can exchange DMs.
create or replace function public.are_cuemoo_friends(a uuid,b uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.friend_requests
 where status='accepted' and ((sender_id=a and receiver_id=b) or (sender_id=b and receiver_id=a))) $$;

drop policy if exists "Group members can view groups" on public.chat_groups;
create policy "Group members can view groups" on public.chat_groups for select to authenticated
using (exists(select 1 from public.chat_group_members m where m.group_id=id and m.user_id=auth.uid()));
drop policy if exists "Signed-in users can create groups" on public.chat_groups;
create policy "Signed-in users can create groups" on public.chat_groups for insert to authenticated
with check(created_by=auth.uid());
drop policy if exists "Group creator can edit group" on public.chat_groups;
create policy "Group creator can edit group" on public.chat_groups for update to authenticated
using(created_by=auth.uid()) with check(created_by=auth.uid());

drop policy if exists "Members can view group membership" on public.chat_group_members;
create policy "Members can view group membership" on public.chat_group_members for select to authenticated
using(exists(select 1 from public.chat_group_members m where m.group_id=chat_group_members.group_id and m.user_id=auth.uid()));
drop policy if exists "Group creator can add members" on public.chat_group_members;
create policy "Group creator can add members" on public.chat_group_members for insert to authenticated
with check(exists(select 1 from public.chat_groups g where g.id=chat_group_members.group_id and g.created_by=auth.uid()));
drop policy if exists "Members can leave groups" on public.chat_group_members;
create policy "Members can leave groups" on public.chat_group_members for delete to authenticated
using(user_id=auth.uid());

drop policy if exists "Friends can read DMs" on public.direct_messages;
create policy "Friends can read DMs" on public.direct_messages for select to authenticated
using(sender_id=auth.uid() or receiver_id=auth.uid());
drop policy if exists "Friends can send DMs" on public.direct_messages;
create policy "Friends can send DMs" on public.direct_messages for insert to authenticated
with check(sender_id=auth.uid() and public.are_cuemoo_friends(sender_id,receiver_id));
drop policy if exists "Group members can read messages" on public.group_messages;
create policy "Group members can read messages" on public.group_messages for select to authenticated
using(exists(select 1 from public.chat_group_members m where m.group_id=group_messages.group_id and m.user_id=auth.uid()));
drop policy if exists "Group members can send messages" on public.group_messages;
create policy "Group members can send messages" on public.group_messages for insert to authenticated
with check(sender_id=auth.uid() and exists(select 1 from public.chat_group_members m where m.group_id=group_messages.group_id and m.user_id=auth.uid()));

-- Moderators/owner can delete public chat messages; owner can manage roles and bans.
drop policy if exists "Moderators can remove global chat messages" on public.chat_messages;
create policy "Moderators can remove global chat messages" on public.chat_messages for delete to authenticated
using(exists(select 1 from public.chat_profiles p where p.id=auth.uid() and p.role in ('moderator','owner')));
drop policy if exists "Owner can update member moderation" on public.chat_profiles;
create policy "Owner can update member moderation" on public.chat_profiles for update to authenticated
using(exists(select 1 from public.chat_profiles me where me.id=auth.uid() and me.role='owner'))
with check(exists(select 1 from public.chat_profiles me where me.id=auth.uid() and me.role='owner'));

-- Avatar bucket: public display, each user may upload only into their own folder.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cuemoo-avatars','cuemoo-avatars',true,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
drop policy if exists "Public can view CueMoo avatars" on storage.objects;
create policy "Public can view CueMoo avatars" on storage.objects for select using(bucket_id='cuemoo-avatars');
drop policy if exists "Users upload own avatar" on storage.objects;
create policy "Users upload own avatar" on storage.objects for insert to authenticated
with check(bucket_id='cuemoo-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar" on storage.objects for update to authenticated
using(bucket_id='cuemoo-avatars' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='cuemoo-avatars' and (storage.foldername(name))[1]=auth.uid()::text);

-- Realtime feeds for friend, DM and group changes.
do $$ begin
 alter publication supabase_realtime add table public.friend_requests;
exception when duplicate_object then null; end $$;
do $$ begin
 alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null; end $$;
do $$ begin
 alter publication supabase_realtime add table public.group_messages;
exception when duplicate_object then null; end $$;

-- IMPORTANT: after you sign in to CueMoo, run this with your exact username
-- to grant your account owner access. Replace YOUR_USERNAME below.
-- update public.chat_profiles set role='owner' where username=lower('YOUR_USERNAME');
