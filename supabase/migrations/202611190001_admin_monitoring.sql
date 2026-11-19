-- Administrative access is separate from user-editable profile metadata.
create table public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default clock_timestamp()
);
create table public.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  target_id uuid,
  action text not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.site_admins enable row level security;
alter table public.admin_audit enable row level security;
revoke all on public.site_admins, public.admin_audit from public, anon, authenticated;

create function public.is_site_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.site_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;

-- Analytics is opt-in. UUIDs are generated in the browser; account identity and
-- every timestamp are assigned by the database. No URLs, IPs or user agents.
create table public.site_sessions (
  id uuid primary key,
  visitor_id uuid not null,
  user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  device text not null check (device in ('desktop', 'mobile', 'tablet')),
  referrer text not null check (length(referrer) <= 253)
);
create table public.site_activity (
  session_id uuid not null references public.site_sessions(id) on delete cascade,
  day date not null,
  path text not null,
  pageviews integer not null default 0,
  engaged_seconds integer not null default 0,
  primary key (session_id, day, path)
);
create index site_activity_day_idx on public.site_activity(day, session_id);
create index site_sessions_user_idx on public.site_sessions(user_id, last_seen_at);
create index site_sessions_recent_idx on public.site_sessions(last_seen_at);
alter table public.site_sessions enable row level security;
alter table public.site_activity enable row level security;
revoke all on public.site_sessions, public.site_activity from public, anon, authenticated;

create function public.track_site_activity(
  p_session uuid, p_visitor uuid, p_path text, p_pageview boolean,
  p_seconds integer, p_device text, p_referrer text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  stamp timestamptz := clock_timestamp();
  existing public.site_sessions;
  seconds integer := 0;
begin
  if p_session is null or p_visitor is null or p_pageview is null
    or p_path is null or p_path not in ('/', '/cards', '/my-decks', '/public-decks', '/players/:id', '/multiplayer', '/lobby', '/game', '/help')
    or p_device is null or p_device not in ('desktop', 'mobile', 'tablet')
    or p_seconds is null or p_seconds not between 0 and 30
    or p_referrer is null or length(p_referrer) > 253 or p_referrer !~ '^[a-zA-Z0-9.:-]*$' then
    raise exception 'Invalid activity.';
  end if;
  insert into public.site_sessions(id, visitor_id, user_id, device, referrer)
    values (p_session, p_visitor, auth.uid(), p_device, p_referrer) on conflict do nothing;
  select * into existing from public.site_sessions where id = p_session for update;
  if existing.visitor_id <> p_visitor or existing.user_id is distinct from auth.uid() then
    raise exception 'Session identity mismatch.' using errcode = '42501';
  end if;
  -- Bound client-reported engagement by actual elapsed server time. This also
  -- prevents duplicate heartbeats from multiple tabs increasing engagement.
  seconds := least(p_seconds, greatest(0, floor(extract(epoch from stamp - existing.last_seen_at))::integer));
  if not p_pageview and stamp - existing.last_seen_at < interval '15 seconds' then return; end if;
  update public.site_sessions set last_seen_at = stamp where id = p_session;
  insert into public.site_activity(session_id, day, path, pageviews, engaged_seconds)
    values (p_session, (stamp at time zone 'UTC')::date, p_path, case when p_pageview then 1 else 0 end, seconds)
    on conflict (session_id, day, path) do update set
      pageviews = site_activity.pageviews + excluded.pageviews,
      engaged_seconds = site_activity.engaged_seconds + excluded.engaged_seconds;
end;
$$;
revoke all on function public.track_site_activity(uuid, uuid, text, boolean, integer, text, text) from public;
grant execute on function public.track_site_activity(uuid, uuid, text, boolean, integer, text, text) to anon, authenticated;

-- Internal aggregate helper: not callable through the public API.
create function public.site_period_metrics(p_start date, p_end date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with visits as (
    select s.id, s.visitor_id, s.user_id, sum(a.pageviews) as views, sum(a.engaged_seconds) as seconds
    from public.site_activity a join public.site_sessions s on s.id = a.session_id
    where a.day >= p_start and a.day < p_end group by s.id
  )
  select jsonb_build_object(
    'visitors', count(distinct case when user_id is not null then 'u:' || user_id::text else 'v:' || visitor_id::text end),
    'users', count(distinct user_id), 'sessions', count(*), 'pageviews', coalesce(sum(views), 0),
    'engagementSeconds', coalesce(round(avg(seconds)), 0),
    'engagementRate', coalesce(round(100.0 * count(*) filter (where seconds >= 10 or views >= 2) / nullif(count(*), 0), 1), 0)
  ) from visits;
$$;
revoke all on function public.site_period_metrics(date, date) from public, anon, authenticated;

create function public.admin_dashboard(p_start date, p_end date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; today date := (now() at time zone 'UTC')::date;
begin
  if not public.is_site_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end - p_start > 366 or p_end > today + 1 then
    raise exception 'Choose a period of 1 to 366 days, ending no later than today.';
  end if;
  result := jsonb_build_object(
    'current', public.site_period_metrics(p_start, p_end),
    'previous', public.site_period_metrics(p_start - (p_end - p_start), p_start),
    'generatedAt', now(),
    'trackingSince', (select min(started_at) from public.site_sessions),
    'liveVisitors', (select count(distinct case when user_id is not null then 'u:' || user_id::text else 'v:' || visitor_id::text end)
      from public.site_sessions where last_seen_at > now() - interval '5 minutes'),
    'liveUsers', (select count(distinct user_id) from public.site_sessions where last_seen_at > now() - interval '5 minutes'),
    'registeredUsers', (select count(*) from auth.users),
    'newUsers', (select count(*) from auth.users where created_at >= p_start::timestamp at time zone 'UTC' and created_at < p_end::timestamp at time zone 'UTC'),
    'totalDecks', (select count(*) from public.decks),
    'publicDecks', (select count(*) from public.decks where visibility = 'public'),
    'newDecks', (select count(*) from public.decks where created_at >= p_start::timestamp at time zone 'UTC' and created_at < p_end::timestamp at time zone 'UTC'),
    'newComments', (select count(*) from public.deck_comments where created_at >= p_start::timestamp at time zone 'UTC' and created_at < p_end::timestamp at time zone 'UTC'),
    'activeUsers', (select jsonb_build_object(
      'daily', count(distinct s.user_id) filter (where a.day >= today),
      'weekly', count(distinct s.user_id) filter (where a.day >= today - 6),
      'monthly', count(distinct s.user_id))
      from public.site_activity a join public.site_sessions s on s.id = a.session_id where a.day >= today - 29),
    'daily', (select coalesce(jsonb_agg(row_to_json(t) order by t.day), '[]'::jsonb) from (
      select d::date as day, count(distinct case when s.user_id is not null then 'u:' || s.user_id::text else 'v:' || s.visitor_id::text end) as visitors,
        count(distinct s.user_id) as users, coalesce(sum(a.pageviews), 0) as pageviews
      from generate_series(p_start::timestamp, (p_end - 1)::timestamp, interval '1 day') d
      left join public.site_activity a on a.day = d::date left join public.site_sessions s on s.id = a.session_id group by d
    ) t),
    'pages', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
      select path as name, sum(pageviews) as value from public.site_activity where day >= p_start and day < p_end
      group by path order by sum(pageviews) desc, path limit 12
    ) t),
    'devices', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
      select s.device as name, count(distinct s.id) as value from public.site_sessions s join public.site_activity a on a.session_id = s.id
      where a.day >= p_start and a.day < p_end group by s.device order by count(distinct s.id) desc
    ) t),
    'referrers', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
      select coalesce(nullif(s.referrer, ''), 'Direct / unknown') as name, count(distinct s.id) as value
      from public.site_sessions s join public.site_activity a on a.session_id = s.id
      where a.day >= p_start and a.day < p_end group by s.referrer order by count(distinct s.id) desc, s.referrer limit 10
    ) t),
    'chronicles', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
      select faction as name, count(*) as value from public.decks group by faction order by count(*) desc, faction
    ) t),
    'audit', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
      select a.id, a.action, a.actor_id, a.target_id, a.created_at, p.name as actor_name
      from public.admin_audit a left join public.player_profiles p on p.id = a.actor_id order by a.id desc limit 20
    ) t)
  );
  return result;
end;
$$;
revoke all on function public.admin_dashboard(date, date) from public, anon;
grant execute on function public.admin_dashboard(date, date) to authenticated;

create function public.admin_users(p_search text default '', p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_site_admin() then raise exception 'Administrator access required.' using errcode = '42501'; end if;
  if p_offset is null or p_offset < 0 or p_search is null or length(p_search) > 100 then raise exception 'Invalid search.'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.player_profiles p where p.name ilike '%' || p_search || '%' or p.id::text = p_search),
    'users', (select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
      select p.id, p.name, u.created_at, exists(select 1 from public.site_admins sa where sa.user_id = p.id) as is_admin,
        (select max(s.last_seen_at) from public.site_sessions s where s.user_id = p.id) as last_seen_at
      from public.player_profiles p join auth.users u on u.id = p.id
      where p.name ilike '%' || p_search || '%' or p.id::text = p_search
      order by u.created_at desc, p.id limit 25 offset p_offset
    ) t)
  );
end;
$$;
revoke all on function public.admin_users(text, integer) from public, anon;
grant execute on function public.admin_users(text, integer) to authenticated;

-- Retain at most 13 months of opt-in telemetry. Schedule this owner-only helper
-- daily through pg_cron / your DB scheduler; never delete during public requests.
create function public.prune_site_analytics() returns void
language sql security definer set search_path = '' as $$
  delete from public.site_activity where day < (now() at time zone 'UTC')::date - 395;
  delete from public.site_sessions where last_seen_at < now() - interval '395 days';
$$;
revoke all on function public.prune_site_analytics() from public, anon, authenticated;
