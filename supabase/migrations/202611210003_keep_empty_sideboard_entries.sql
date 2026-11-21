create or replace function public.valid_deck_content(payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  item jsonb;
  in_sideboard boolean;
  main_cards integer;
  sideboard jsonb := coalesce(payload->'sideboard', '[]'::jsonb);
begin
  if jsonb_typeof(payload) is distinct from 'object'
    or jsonb_typeof(payload->'persona') is distinct from 'array'
    or jsonb_typeof(payload->'deck') is distinct from 'array'
    or jsonb_typeof(sideboard) is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(payload->'persona') > 5
    or jsonb_array_length(payload->'deck') > 45
    or pg_column_size(payload - 'sideboard') > 32768 then
    return false;
  end if;
  for item in select value from jsonb_array_elements(payload->'persona') loop
    if jsonb_typeof(item) is distinct from 'string'
      or char_length(item #>> '{}') not between 1 and 100 then
      return false;
    end if;
  end loop;
  for item, in_sideboard in
    select value, false from jsonb_array_elements(payload->'deck')
    union all
    select value, true from jsonb_array_elements(sideboard)
  loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'id') is distinct from 'string'
      or char_length(item->>'id') not between 1 and 100
      or jsonb_typeof(item->'qty') is distinct from 'number'
      or coalesce((item->>'qty') !~ (case when in_sideboard then '^[0-4]$' else '^[1-4]$' end), true) then
      return false;
    end if;
  end loop;

  select coalesce(sum((entry->>'qty')::integer), 0) into main_cards
  from jsonb_array_elements(payload->'deck') as cards(entry);
  if main_cards > 45 then
    return false;
  end if;

  -- Preserve compatibility with decks stored before sideboards were supported.
  if not (payload ? 'sideboard') then
    return true;
  end if;

  -- Match the deck builder's shared identity for APX A/B print variants.
  return not exists (
    select 1
    from jsonb_array_elements((payload->'deck') || sideboard) as cards(entry)
    group by regexp_replace(
      lower(regexp_replace(entry->>'id', '^[[:space:]]+|[[:space:]]+$', '', 'g')),
      '^(apx_[^_]+_[^_]+)_[ab](_n)$', '\1_a\2'
    )
    having sum((entry->>'qty')::integer) > 4
  );
end;
$$;

create or replace function public.valid_persona_sideboard(payload jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(payload->'persona') = 'array' and jsonb_typeof(payload->'sideboard') = 'array'
    then not exists (
      select 1
      from (
        select id, false as in_sideboard from jsonb_array_elements_text(payload->'persona') as persona(id)
        union all
        select item->>'id', true from jsonb_array_elements(payload->'sideboard') as sideboard(item)
        where (item->>'qty') is distinct from '0'
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
