begin;

create or replace function public.set_public_deck_like(p_deck_id uuid, p_liked boolean) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  viewer_id uuid := auth.uid();
  source_owner_id uuid;
begin
  if viewer_id is null then
    raise exception 'Sign in to like decks.' using errcode = '42501';
  end if;
  source_owner_id := (public.lock_published_deck(p_deck_id)).owner_id;
  if viewer_id = source_owner_id then
    raise exception 'You cannot like your own deck.' using errcode = '42501';
  end if;
  if p_liked then
    insert into public.deck_likes (user_id, deck_id) values (viewer_id, p_deck_id)
      on conflict (user_id, deck_id) do nothing;
  else
    delete from public.deck_likes where user_id = viewer_id and deck_id = p_deck_id;
  end if;
  return coalesce((select like_count from public.deck_engagement where deck_id = p_deck_id), 0);
end;
$$;

create or replace function public.record_public_deck_view(p_deck_id uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  total bigint;
  source_owner_id uuid;
begin
  source_owner_id := (public.lock_published_deck(p_deck_id)).owner_id;
  if auth.uid() = source_owner_id then
    return coalesce((select view_count from public.deck_engagement where deck_id = p_deck_id), 0);
  end if;
  insert into public.deck_engagement as e (deck_id, view_count) values (p_deck_id, 1)
    on conflict (deck_id) do update set view_count = e.view_count + 1
    returning e.view_count into total;
  return total;
end;
$$;

create or replace function public.record_local_public_deck_import(p_deck_id uuid, p_copy_id uuid) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  source_owner_id uuid;
begin
  source_owner_id := (public.lock_published_deck(p_deck_id)).owner_id;
  if auth.uid() is distinct from source_owner_id then
    insert into public.deck_import_receipts (deck_id, copy_id, is_local) values (p_deck_id, p_copy_id, true)
      on conflict (deck_id, copy_id, is_local) do nothing;
    if found then
      return public.increment_deck_import_count(p_deck_id);
    end if;
  end if;
  return coalesce((select import_count from public.deck_engagement where deck_id = p_deck_id), 0);
end;
$$;

create or replace function public.import_public_deck(p_deck_id uuid, p_copy_id uuid)
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
    if viewer_id <> source.owner_id then
      perform public.increment_deck_import_count(p_deck_id);
    end if;
  else
    select d.id, d.name into strict id, name from public.decks d
      where d.id = p_copy_id and d.owner_id = viewer_id
        and exists (select 1 from public.deck_import_receipts r
          where r.deck_id = p_deck_id and r.copy_id = p_copy_id and not r.is_local);
  end if;
  import_count := coalesce((select e.import_count from public.deck_engagement e where e.deck_id = p_deck_id), 0);
  return next;
end;
$$;

-- The existing trigger updates the like totals when the author's old like is removed.
delete from public.deck_likes l using public.decks d
where l.deck_id = d.id and l.user_id = d.owner_id;

commit;
