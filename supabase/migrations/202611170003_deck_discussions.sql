alter table public.decks add column description text not null default ''
  check (char_length(description) <= 5000);

create table public.deck_comments (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid,
  body text not null check (char_length(body) between 1 and 2000 and body ~ '[^[:space:]]'),
  created_at timestamptz not null default clock_timestamp(),
  unique (id, deck_id),
  foreign key (parent_id, deck_id) references public.deck_comments(id, deck_id) on delete cascade,
  check (parent_id is null or parent_id <> id)
);
create index deck_comments_deck_created_idx on public.deck_comments(deck_id, created_at, id);
create index deck_comments_author_idx on public.deck_comments(author_id, deck_id);
create index deck_comments_parent_idx on public.deck_comments(parent_id, deck_id);

alter table public.deck_comments enable row level security;
revoke all on public.deck_comments from anon, authenticated;
grant select on public.deck_comments to anon, authenticated;
grant insert (id, deck_id, author_id, parent_id, body) on public.deck_comments to authenticated;
create policy "Read comments on public decks" on public.deck_comments for select to anon, authenticated
  using (exists (select 1 from public.decks d where d.id = deck_id and d.visibility = 'public'));
create policy "Comment as yourself on public decks" on public.deck_comments for insert to authenticated
  with check (author_id = (select auth.uid())
    and exists (select 1 from public.decks d where d.id = deck_id and d.visibility = 'public'));

-- Replies must refer to an existing comment on the same deck. With no updates
-- allowed, this also prevents cycles and moving a reply to another discussion.
create function public.check_comment_parent() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.created_at = clock_timestamp();
  if new.parent_id is not null and not exists (
    select 1 from public.deck_comments c where c.id = new.parent_id and c.deck_id = new.deck_id
  ) then
    raise exception 'Reply target is not available on this deck.' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.check_comment_parent() from public, anon, authenticated;
create trigger check_comment_parent before insert on public.deck_comments
  for each row execute function public.check_comment_parent();

-- Commenters also have a readable player profile, even without published decks.
drop policy "Read authors of public decks or own profile" on public.player_profiles;
create policy "Read public participants or own profile" on public.player_profiles for select to anon, authenticated
  using (id = (select auth.uid())
    or exists (select 1 from public.decks d where d.owner_id = player_profiles.id and d.visibility = 'public')
    or exists (select 1 from public.deck_comments c join public.decks d on d.id = c.deck_id
      where c.author_id = player_profiles.id and d.visibility = 'public'));
