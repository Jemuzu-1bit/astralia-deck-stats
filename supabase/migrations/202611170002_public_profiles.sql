-- Expose only the fields intended for player profiles, never auth records.
create table public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  avatar text not null default '',
  bio text not null default '',
  favorite_chronicle text not null default '',
  website text not null default ''
);

alter table public.player_profiles enable row level security;
revoke all on public.player_profiles from anon, authenticated;
grant select on public.player_profiles to anon, authenticated;
create policy "Read authors of public decks or own profile"
  on public.player_profiles for select to anon, authenticated
  using (id = (select auth.uid()) or exists (
    select 1 from public.decks where owner_id = player_profiles.id and visibility = 'public'
  ));

-- Kept in sync in the same transaction as profile edits and Discord sign-ins.
-- This function is callable only by the auth trigger / database owner.
create function public.sync_player_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.player_profiles(id, name, avatar, bio, favorite_chronicle, website)
  values (
    new.id,
    left(coalesce(nullif(trim(metadata #>> '{custom_claims,global_name}'), ''),
      nullif(trim(metadata->>'global_name'), ''), nullif(trim(metadata->>'full_name'), ''),
      nullif(trim(metadata->>'name'), ''), nullif(trim(metadata->>'preferred_username'), ''),
      nullif(trim(metadata->>'user_name'), ''), 'Discord user'), 100),
    left(coalesce(metadata->>'avatar_url', metadata->>'picture', ''), 2048),
    left(coalesce(metadata #>> '{player_profile,bio}', ''), 300),
    left(coalesce(metadata #>> '{player_profile,favoriteChronicle}', ''), 32),
    left(coalesce(metadata #>> '{player_profile,website}', ''), 2048)
  ) on conflict (id) do update set
    name = excluded.name, avatar = excluded.avatar, bio = excluded.bio,
    favorite_chronicle = excluded.favorite_chronicle, website = excluded.website;
  return new;
end;
$$;
revoke all on function public.sync_player_profile() from public, anon, authenticated;
create trigger sync_player_profile after insert or update of raw_user_meta_data on auth.users
  for each row execute function public.sync_player_profile();

-- Backfill without modifying auth users or triggering unrelated auth hooks.
insert into public.player_profiles(id, name, avatar, bio, favorite_chronicle, website)
select id,
  left(coalesce(nullif(trim(raw_user_meta_data #>> '{custom_claims,global_name}'), ''),
    nullif(trim(raw_user_meta_data->>'global_name'), ''), nullif(trim(raw_user_meta_data->>'full_name'), ''),
    nullif(trim(raw_user_meta_data->>'name'), ''), nullif(trim(raw_user_meta_data->>'preferred_username'), ''),
    nullif(trim(raw_user_meta_data->>'user_name'), ''), 'Discord user'), 100),
  left(coalesce(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture', ''), 2048),
  left(coalesce(raw_user_meta_data #>> '{player_profile,bio}', ''), 300),
  left(coalesce(raw_user_meta_data #>> '{player_profile,favoriteChronicle}', ''), 32),
  left(coalesce(raw_user_meta_data #>> '{player_profile,website}', ''), 2048)
from auth.users;

create index decks_public_owner_idx on public.decks(owner_id, published_at desc, id)
  where visibility = 'public';

-- Qualify the storage name: inside the subquery an unqualified "name" would
-- resolve to decks.name instead of the object's path and hide public covers.
drop policy "Read own or published deck backgrounds" on storage.objects;
create policy "Read own or published deck backgrounds" on storage.objects for select
  to anon, authenticated using (
    bucket_id = 'deck-backgrounds' and (
      split_part(storage.objects.name, '/', 1) = (select auth.uid())::text
      or exists (
        select 1 from public.decks d
        where d.id::text = split_part(storage.objects.name, '/', 2)
          and d.visibility = 'public'
          and d.background_image_path = storage.objects.name
      )
    )
  );
