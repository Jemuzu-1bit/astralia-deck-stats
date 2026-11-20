create or replace function public.valid_deck_content(payload jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  item jsonb;
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
  for item in select value from jsonb_array_elements((payload->'deck') || sideboard) loop
    if jsonb_typeof(item) is distinct from 'object'
      or jsonb_typeof(item->'id') is distinct from 'string'
      or char_length(item->>'id') not between 1 and 100
      or jsonb_typeof(item->'qty') is distinct from 'number'
      or coalesce((item->>'qty') !~ '^[1-4]$', true) then
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
