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
      jsonb_build_object('persona', source.content->'persona', 'deck', source.content->'deck'))
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
