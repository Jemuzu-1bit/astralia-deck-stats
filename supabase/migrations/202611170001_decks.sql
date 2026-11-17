-- Decks keep stable card IDs. Card metadata and image URLs belong to the card catalog,
-- so moving image delivery to Cloudflare does not change stored decks.
create function public.valid_deck_content(payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  item jsonb;
  total_cards integer := 0;
begin
  if jsonb_typeof(payload) is distinct from 'object'
    or jsonb_typeof(payload->'persona') is distinct from 'array'
    or jsonb_typeof(payload->'deck') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(payload->'persona') > 5
    or jsonb_array_length(payload->'deck') > 45
    or pg_column_size(payload) > 32768 then
    return false;
  end if;
  for item in select value from jsonb_array_elements(payload->'persona') loop
    if jsonb_typeof(item) is distinct from 'string'
      or char_length(item #>> '{}') not between 1 and 100 then
      return false;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(payload->'deck') loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'id') is distinct from 'string'
      or char_length(item->>'id') not between 1 and 100
      or jsonb_typeof(item->'qty') is distinct from 'number'
      or coalesce((item->>'qty') !~ '^[1-4]$', true) then
      return false;
    end if;
    total_cards := total_cards + (item->>'qty')::integer;
  end loop;
  return total_cards <= 45;
end;
$$;

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  import_key text check (import_key is null or char_length(import_key) between 1 and 100),
  name text not null check (char_length(name) between 1 and 100),
  faction text not null check (char_length(faction) between 1 and 32),
  protagonist_id text check (protagonist_id is null or char_length(protagonist_id) between 1 and 100),
  content_version integer not null default 1 check (content_version = 1),
  content jsonb not null default '{"persona":[],"deck":[]}'::jsonb
    check (public.valid_deck_content(content)),
  background_image_path text check (
    background_image_path is null or (
      char_length(background_image_path) <= 250
      and
      split_part(background_image_path, '/', 1) = owner_id::text
      and split_part(background_image_path, '/', 2) = id::text
    )
  ),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  published_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publication_date_matches_visibility check (
    (visibility = 'private' and published_at is null)
    or (visibility = 'public' and published_at is not null)
  )
);

create index decks_owner_updated_idx on public.decks(owner_id, updated_at desc);
create unique index decks_owner_import_key_idx on public.decks(owner_id, import_key);
create index decks_public_recent_idx on public.decks(published_at desc, id)
  where visibility = 'public';

create function public.set_deck_timestamps() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' then
    new.created_at = now();
    new.revision = 1;
    new.published_at = case when new.visibility = 'public' then now() else null end;
  else
    new.created_at = old.created_at;
    new.revision = old.revision + 1;
    new.owner_id = old.owner_id;
    if new.visibility = 'private' then
      new.published_at = null;
    elsif old.visibility = 'private' then
      new.published_at = now();
    else
      new.published_at = old.published_at;
    end if;
  end if;
  return new;
end;
$$;

create trigger decks_timestamps before insert or update on public.decks
for each row execute function public.set_deck_timestamps();

alter table public.decks enable row level security;
grant select on public.decks to anon;
grant select, insert, update, delete on public.decks to authenticated;
create policy "Read own or published decks" on public.decks for select
  to anon, authenticated using (owner_id = (select auth.uid()) or visibility = 'public');
create policy "Create own decks" on public.decks for insert
  to authenticated with check (owner_id = (select auth.uid()));
create policy "Update own decks" on public.decks for update
  to authenticated using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Delete own decks" on public.decks for delete
  to authenticated using (owner_id = (select auth.uid()));

-- Private storage for user backgrounds. Card art will use a separate Cloudflare
-- origin; no card image is stored in this bucket or in a deck row.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('deck-backgrounds', 'deck-backgrounds', false, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

create policy "Read own or published deck backgrounds" on storage.objects for select
  to anon, authenticated using (
    bucket_id = 'deck-backgrounds' and (
      split_part(name, '/', 1) = (select auth.uid())::text
      or exists (
        select 1 from public.decks d
        where d.id::text = split_part(name, '/', 2)
          and d.visibility = 'public'
          and d.background_image_path = name
      )
    )
  );
create policy "Upload own deck backgrounds" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'deck-backgrounds' and split_part(name, '/', 1) = (select auth.uid())::text
  );
create policy "Delete own deck backgrounds" on storage.objects for delete
  to authenticated using (
    bucket_id = 'deck-backgrounds' and split_part(name, '/', 1) = (select auth.uid())::text
  );
