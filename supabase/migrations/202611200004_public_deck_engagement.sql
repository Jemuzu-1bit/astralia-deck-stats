create table public.deck_engagement (
  deck_id uuid primary key references public.decks(id) on delete cascade,
  like_count bigint not null default 0 check (like_count >= 0),
  view_count bigint not null default 0 check (view_count >= 0),
  import_count bigint not null default 0 check (import_count >= 0)
);

create table public.deck_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  primary key (user_id, deck_id)
);
create index deck_likes_deck_idx on public.deck_likes(deck_id);

-- Copy IDs keep retries idempotent for local and cloud imports.
create table public.deck_import_receipts (
  deck_id uuid not null references public.decks(id) on delete cascade,
  copy_id uuid not null,
  is_local boolean not null,
  primary key (deck_id, copy_id, is_local)
);

alter table public.deck_engagement enable row level security;
alter table public.deck_likes enable row level security;
alter table public.deck_import_receipts enable row level security;
revoke all on public.deck_engagement, public.deck_likes, public.deck_import_receipts from public, anon, authenticated;
grant select on public.deck_engagement, public.deck_likes to anon, authenticated;

create policy "Read published deck counts" on public.deck_engagement for select to anon, authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.visibility = 'public'));
create policy "Read own published deck likes" on public.deck_likes for select to authenticated
  using (user_id = (select auth.uid())
    and exists (select 1 from public.decks d where d.id = deck_id and d.visibility = 'public'));

create view public.published_decks with (security_invoker = true) as
  select d.id, d.owner_id, d.name, d.description, d.faction, d.protagonist_id, d.content,
    d.background_image_path, d.updated_at, d.published_at,
    coalesce(e.like_count, 0) as like_count, coalesce(e.view_count, 0) as view_count,
    coalesce(e.import_count, 0) as import_count,
    exists (select 1 from public.deck_likes l
      where l.deck_id = d.id and l.user_id = (select auth.uid())) as liked_by_viewer
  from public.decks d left join public.deck_engagement e on e.deck_id = d.id
  where d.visibility = 'public';

revoke all on public.published_decks from public, anon, authenticated;
grant select on public.published_decks to anon, authenticated;

-- Check and lock the publication for the duration of each write, including imports.
create function public.lock_published_deck(p_deck_id uuid) returns public.decks
language plpgsql set search_path = '' as $$
declare
  source public.decks;
begin
  select * into source from public.decks where id = p_deck_id and visibility = 'public' for share;
  if not found then
    raise exception 'This deck is no longer public. Refresh the collection.';
  end if;
  return source;
end;
$$;

-- Account deletion cascades through likes and updates the public total as well.
create function public.update_deck_like_count() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.deck_engagement as e (deck_id, like_count) values (new.deck_id, 1)
      on conflict (deck_id) do update set like_count = e.like_count + 1;
  else
    update public.deck_engagement set like_count = like_count - 1 where deck_id = old.deck_id;
  end if;
  return null;
end;
$$;

create trigger deck_likes_count after insert or delete on public.deck_likes
for each row execute function public.update_deck_like_count();

create function public.set_public_deck_like(p_deck_id uuid, p_liked boolean) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then
    raise exception 'Sign in to like decks.' using errcode = '42501';
  end if;
  perform public.lock_published_deck(p_deck_id);
  if p_liked then
    insert into public.deck_likes (user_id, deck_id) values (viewer_id, p_deck_id)
      on conflict (user_id, deck_id) do nothing;
  else
    delete from public.deck_likes where user_id = viewer_id and deck_id = p_deck_id;
  end if;
  return coalesce((select like_count from public.deck_engagement where deck_id = p_deck_id), 0);
end;
$$;

create function public.record_public_deck_view(p_deck_id uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  total bigint;
begin
  perform public.lock_published_deck(p_deck_id);
  insert into public.deck_engagement as e (deck_id, view_count) values (p_deck_id, 1)
    on conflict (deck_id) do update set view_count = e.view_count + 1
    returning e.view_count into total;
  return total;
end;
$$;

create function public.increment_deck_import_count(p_deck_id uuid) returns bigint
language sql set search_path = '' as $$
  insert into public.deck_engagement as e (deck_id, import_count) values (p_deck_id, 1)
    on conflict (deck_id) do update set import_count = e.import_count + 1
    returning e.import_count;
$$;

create function public.record_local_public_deck_import(p_deck_id uuid, p_copy_id uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_published_deck(p_deck_id);
  insert into public.deck_import_receipts (deck_id, copy_id, is_local) values (p_deck_id, p_copy_id, true)
    on conflict (deck_id, copy_id, is_local) do nothing;
  if found then
    return public.increment_deck_import_count(p_deck_id);
  end if;
  return (select import_count from public.deck_engagement where deck_id = p_deck_id);
end;
$$;

create function public.import_public_deck(p_deck_id uuid, p_copy_id uuid)
returns table (id uuid, name text, import_count bigint)
language plpgsql security definer set search_path = '' as $$
declare
  viewer_id uuid := auth.uid();
  source public.decks;
begin
  if viewer_id is null then
    raise exception 'Sign in to save decks online.' using errcode = '42501';
  end if;
  source := public.lock_published_deck(p_deck_id);
  insert into public.decks as d (id, owner_id, name, description, faction, protagonist_id, content)
    values (p_copy_id, viewer_id, source.name, source.description, source.faction, source.protagonist_id,
      jsonb_strip_nulls(jsonb_build_object('persona', source.content->'persona',
        'deck', source.content->'deck', 'sideboard', source.content->'sideboard')))
    on conflict on constraint decks_pkey do nothing
    returning d.id, d.name into id, name;
  if found then
    insert into public.deck_import_receipts (deck_id, copy_id, is_local) values (p_deck_id, p_copy_id, false);
    import_count := public.increment_deck_import_count(p_deck_id);
  else
    select d.id, d.name into strict id, name from public.decks d
      where d.id = p_copy_id and d.owner_id = viewer_id
        and exists (select 1 from public.deck_import_receipts r
          where r.deck_id = p_deck_id and r.copy_id = p_copy_id and not r.is_local);
    select e.import_count into import_count from public.deck_engagement e where e.deck_id = p_deck_id;
  end if;
  return next;
end;
$$;

revoke all on function public.lock_published_deck(uuid), public.update_deck_like_count(),
  public.increment_deck_import_count(uuid), public.set_public_deck_like(uuid, boolean),
  public.record_public_deck_view(uuid), public.record_local_public_deck_import(uuid, uuid),
  public.import_public_deck(uuid, uuid) from public, anon, authenticated;
grant execute on function public.set_public_deck_like(uuid, boolean), public.import_public_deck(uuid, uuid) to authenticated;
grant execute on function public.record_public_deck_view(uuid), public.record_local_public_deck_import(uuid, uuid) to anon, authenticated;
