create function public.valid_persona_sideboard(payload jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(payload->'persona') = 'array' and jsonb_typeof(payload->'sideboard') = 'array'
    then not exists (
      select 1
      from (
        select id, false as in_sideboard from jsonb_array_elements_text(payload->'persona') as persona(id)
        union all
        select item->>'id', true from jsonb_array_elements(payload->'sideboard') as sideboard(item)
      ) as placements
      group by regexp_replace(
        lower(regexp_replace(id, '^[[:space:]]+|[[:space:]]+$', '', 'g')),
        '^(apx_[^_]+_[^_]+)_[ab](_n)$', '\1_a\2'
      )
      having bool_or(in_sideboard) and not bool_and(in_sideboard)
    )
    else true
  end;
$$;

alter table public.decks add constraint decks_persona_sideboard_exclusive
  check (public.valid_persona_sideboard(content));
