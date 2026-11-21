alter table public.player_profiles
  add column appearance jsonb not null default '{}'::jsonb,
  add column discord_appearance jsonb not null default '{}'::jsonb;

create or replace function public.sync_player_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  preferences jsonb := metadata #> '{player_profile,appearance}';
  discord jsonb := metadata->'discord_profile';
  cover text := preferences->>'cover';
  show_decoration boolean := coalesce(preferences->'showAvatarDecoration' = 'true'::jsonb, false);
  show_nameplate boolean := coalesce(preferences->'showNameplate' = 'true'::jsonb, false);
  show_guild_tag boolean := coalesce(preferences->'showGuildTag' = 'true'::jsonb, false);
  featured_id uuid;
begin
  if preferences->>'featuredDeckId' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then
    select d.id into featured_id from public.decks d
    where d.id = (preferences->>'featuredDeckId')::uuid and d.owner_id = new.id and d.visibility = 'public'
    for share;
  end if;

  insert into public.player_profiles(id, name, avatar, bio, favorite_chronicle, website, appearance, discord_appearance)
  values (
    new.id,
    left(coalesce(nullif(trim(metadata #>> '{custom_claims,global_name}'), ''),
      nullif(trim(metadata->>'global_name'), ''), nullif(trim(metadata->>'full_name'), ''),
      nullif(trim(metadata->>'name'), ''), nullif(trim(metadata->>'preferred_username'), ''),
      nullif(trim(metadata->>'user_name'), ''), 'Discord user'), 100),
    left(coalesce(metadata->>'avatar_url', metadata->>'picture', ''), 2048),
    left(coalesce(metadata #>> '{player_profile,bio}', ''), 300),
    left(coalesce(metadata #>> '{player_profile,favoriteChronicle}', ''), 32),
    left(coalesce(metadata #>> '{player_profile,website}', ''), 2048),
    jsonb_strip_nulls(jsonb_build_object(
      'cover', case when cover in ('discord', 'solid') then cover else 'chronicle' end,
      'coverColor', case when cover = 'solid' and preferences->>'coverColor' ~* '^#[0-9a-f]{6}$' then preferences->>'coverColor' end,
      'showAvatarDecoration', show_decoration,
      'showNameplate', show_nameplate,
      'showGuildTag', show_guild_tag,
      'featuredDeckId', featured_id,
      'favoriteCardId', case when preferences->>'favoriteCardId' ~* '^[a-z0-9_-]{1,100}$' then preferences->>'favoriteCardId' end,
      'effect', case when preferences->>'effect' = 'chronicle' then 'chronicle' else 'none' end
    )),
    jsonb_strip_nulls(jsonb_build_object(
      'id', case when (cover = 'discord' or discord->>'avatar' ~ '^(a_)?[0-9a-f]{32}$')
        and discord->>'id' ~ '^[0-9]{17,20}$' then discord->>'id' end,
      'avatar', case when discord->>'avatar' ~ '^(a_)?[0-9a-f]{32}$' then discord->>'avatar' end,
      'banner', case when cover = 'discord' and discord->>'banner' ~ '^(a_)?[0-9a-f]{32}$' then discord->>'banner' end,
      'accent', case when cover = 'discord' and discord->>'accent' ~* '^#[0-9a-f]{6}$' then discord->>'accent' end,
      'decoration', case when show_decoration and discord->>'decoration' ~ '^(a_)?[0-9a-f]{32}$' then discord->>'decoration' end,
      'nameplate', case when show_nameplate and discord->>'nameplate' ~* '^nameplates/([a-z0-9_-]{1,100}/){1,4}$' then discord->>'nameplate' end,
      'nameplatePalette', case when show_nameplate and discord->>'nameplatePalette' in (
        'crimson', 'berry', 'sky', 'teal', 'forest', 'bubble_gum', 'violet', 'cobalt', 'clover', 'lemon', 'white'
      ) then discord->>'nameplatePalette' end,
      'guildTag', case when show_guild_tag and jsonb_typeof(discord->'guildTag') = 'string' then left(discord->>'guildTag', 16) end,
      'guildBadge', case when show_guild_tag and discord->>'guildBadge' ~ '^(a_)?[0-9a-f]{32}$' then discord->>'guildBadge' end,
      'guildId', case when show_guild_tag and discord->>'guildId' ~ '^[0-9]{17,20}$' then discord->>'guildId' end
    ))
  ) on conflict (id) do update set
    name = excluded.name, avatar = excluded.avatar, bio = excluded.bio,
    favorite_chronicle = excluded.favorite_chronicle, website = excluded.website,
    appearance = excluded.appearance, discord_appearance = excluded.discord_appearance;
  return new;
end;
$$;

create function public.sync_featured_deck_visibility() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.visibility = 'public' then
    update public.player_profiles p
    set appearance = jsonb_set(p.appearance, '{featuredDeckId}', to_jsonb(new.id))
    from auth.users u
    where p.id = new.owner_id and u.id = p.id
      and lower(u.raw_user_meta_data #>> '{player_profile,appearance,featuredDeckId}') = new.id::text;
    return null;
  end if;

  update public.player_profiles
  set appearance = appearance - 'featuredDeckId'
  where id = old.owner_id and appearance->>'featuredDeckId' = old.id::text;
  return null;
end;
$$;
revoke all on function public.sync_featured_deck_visibility() from public, anon, authenticated;

create trigger sync_featured_deck_visibility after update of visibility on public.decks
  for each row when (old.visibility is distinct from new.visibility)
  execute function public.sync_featured_deck_visibility();
create trigger clear_deleted_featured_deck after delete on public.decks
  for each row when (old.visibility = 'public')
  execute function public.sync_featured_deck_visibility();
