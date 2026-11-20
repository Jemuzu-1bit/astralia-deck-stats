-- Keep replies when their parent comment is deleted.
alter table public.deck_comments
  drop constraint deck_comments_parent_id_deck_id_fkey,
  add constraint deck_comments_parent_id_deck_id_fkey
    foreign key (parent_id, deck_id) references public.deck_comments(id, deck_id)
    on delete set null (parent_id);

grant update (body), delete on public.deck_comments to authenticated;

create policy "Edit your comments on public decks" on public.deck_comments for update to authenticated
  using (author_id = (select auth.uid())
    and exists (select 1 from public.decks d where d.id = deck_id and d.visibility = 'public'))
  with check (author_id = (select auth.uid())
    and exists (select 1 from public.decks d where d.id = deck_id and d.visibility = 'public'));

create policy "Delete your comments on public decks" on public.deck_comments for delete to authenticated
  using (author_id = (select auth.uid())
    and exists (select 1 from public.decks d where d.id = deck_id and d.visibility = 'public'));
