// Real Postgres permission and analytics tests; uses the same isolated runtime
// as publicDecks.test.mjs, never the live Supabase project.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

const runtime = process.env.PUBLIC_DECKS_TEST_RUNTIME;
if (!runtime) throw new Error('Set PUBLIC_DECKS_TEST_RUNTIME to the npm prefix containing @electric-sql/pglite.');
const { PGlite } = await import(pathToFileURL(join(runtime, 'node_modules/@electric-sql/pglite/dist/index.js')).href);
const owner = '10000000-0000-4000-8000-000000000001';
const player = '20000000-0000-4000-8000-000000000002';
const outsider = '30000000-0000-4000-8000-000000000003';
const guestSession = '40000000-0000-4000-8000-000000000004';
const visitor = '50000000-0000-4000-8000-000000000005';
const accountSession = '60000000-0000-4000-8000-000000000006';

test('backend-only admin roles and opt-in monitoring enforce database boundaries', async () => {
  const db = new PGlite();
  const asRole = (role, id, sql, params = []) => db.transaction(async tx => {
    assert.ok(['anon', 'authenticated'].includes(role));
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id ?? '']);
    return (await tx.query(sql, params)).rows;
  });
  const authed = (id, sql, params) => asRole('authenticated', id, sql, params);
  const anon = (sql, params) => asRole('anon', null, sql, params);
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz not null default now());
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant usage on schema auth, storage, public to anon, authenticated;
      grant select on storage.objects to anon, authenticated;
    `);
    await db.query("insert into auth.users(id, email, raw_user_meta_data) values ($1, 'owner@private.test', '{\"full_name\":\"Site owner\"}'), ($2, 'player@private.test', '{\"full_name\":\"Player\"}'), ($3, 'outsider@private.test', '{\"role\":\"admin\",\"is_admin\":true}')", [owner, player, outsider]);
    for (const migration of ['202611170001_decks.sql', '202611170002_public_profiles.sql', '202611170003_deck_discussions.sql', '202611190001_admin_monitoring.sql', '202611190002_backend_admin_roles.sql']) {
      await db.exec(await readFile(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
    }
    const { today, tomorrow, yesterday } = (await db.query(`select
      (now() at time zone 'UTC')::date::text as today,
      ((now() at time zone 'UTC')::date + 1)::text as tomorrow,
      ((now() at time zone 'UTC')::date - 1)::text as yesterday`)).rows[0];
    for (const id of [owner, player, outsider]) assert.equal((await authed(id, 'select public.is_site_admin() as allowed'))[0].allowed, false);
    await assert.rejects(anon('select public.is_site_admin()'), /permission denied/);
    assert.deepEqual((await db.query("select to_regprocedure('public.claim_site_admin(text)') as claim, to_regprocedure('public.create_admin_setup_code()') as setup, to_regclass('public.admin_setup') as codes")).rows[0], { claim: null, setup: null, codes: null });
    for (const sql of ['select * from public.site_admins', 'select * from public.admin_audit', 'select * from public.site_sessions', 'select * from public.site_activity', "select public.site_period_metrics(current_date, current_date + 1)", 'select public.prune_site_analytics()']) {
      await assert.rejects(authed(player, sql), /permission denied/);
      await assert.rejects(anon(sql), /permission denied/);
    }
    await assert.rejects(authed(player, 'insert into public.site_admins(user_id) values ($1)', [player]), /permission denied/);
    await assert.rejects(authed(player, 'select public.admin_dashboard($1, $2)', [today, tomorrow]), /Administrator access/);
    await assert.rejects(authed(player, 'select public.admin_users()'), /Administrator access/);
    await assert.rejects(authed(player, 'select public.set_site_admin($1, true)', [player]), /permission denied/);
    await assert.rejects(anon('select public.set_site_admin($1, true)', [player]), /permission denied/);
    await db.query('select public.set_site_admin($1, true)', [owner]);
    await db.query('select public.set_site_admin($1, true)', [owner]); // Idempotent, no duplicate audit entry.
    assert.equal((await authed(owner, 'select public.is_site_admin() as allowed'))[0].allowed, true);
    // Even an existing administrator cannot grant/revoke roles with a browser token.
    await assert.rejects(authed(owner, 'select public.set_site_admin($1, true)', [player]), /permission denied/);
    await assert.rejects(authed(owner, 'select public.set_site_admin($1, false)', [owner]), /permission denied/);
    await assert.rejects(db.query('select public.set_site_admin($1, false)', [owner]), /last administrator/);
    await assert.rejects(db.query('select public.set_site_admin($1, null)', [player]), /Select a user/);
    await db.query('select public.set_site_admin($1, true)', [player]);
    await db.query('select public.set_site_admin($1, false)', [owner]);
    assert.equal((await authed(owner, 'select public.is_site_admin() as allowed'))[0].allowed, false);
    await assert.rejects(authed(owner, 'select public.admin_users()'), /Administrator access/);
    await assert.rejects(authed(owner, 'select public.admin_dashboard($1, $2)', [today, tomorrow]), /Administrator access/);
    await assert.rejects(authed(owner, 'select public.set_site_admin($1, true)', [owner]), /permission denied/);
    await assert.rejects(db.query('select public.set_site_admin($1, false)', [player]), /last administrator/);

    const track = 'select public.track_site_activity($1, $2, $3, $4, $5, $6, $7)';
    await anon(track, [guestSession, visitor, '/cards', true, 0, 'desktop', 'example.com']);
    await assert.rejects(authed(owner, track, [guestSession, visitor, '/cards', true, 0, 'desktop', 'example.com']), /identity mismatch/);
    await assert.rejects(anon(track, [guestSession, outsider, '/cards', true, 0, 'desktop', '']), /identity mismatch/);
    for (const path of ['/admin', '/profile', '/lobby/secret', '/cards?secret=foo', null]) {
      await assert.rejects(anon(track, [guestSession, visitor, path, true, 0, 'desktop', '']), /Invalid activity/);
    }
    await assert.rejects(anon(track, [guestSession, visitor, '/cards', true, 31, 'desktop', '']), /Invalid activity/);
    await assert.rejects(anon(track, [guestSession, visitor, '/cards', true, 0, 'desktop', 'example.com/secret']), /Invalid activity/);
    await anon(track, [guestSession, visitor, '/public-decks', true, 0, 'desktop', 'example.com']);
    await authed(owner, track, [accountSession, visitor, '/', true, 0, 'mobile', '']);
    await assert.rejects(anon(track, [accountSession, visitor, '/', true, 0, 'mobile', '']), /identity mismatch/);
    await db.query("update public.site_sessions set last_seen_at = now() - interval '30 seconds' where id = $1", [accountSession]);
    await authed(owner, track, [accountSession, visitor, '/', false, 30, 'mobile', '']);
    await authed(owner, track, [accountSession, visitor, '/', false, 30, 'mobile', '']);
    assert.equal((await db.query('select engaged_seconds from public.site_activity where session_id = $1', [accountSession])).rows[0].engaged_seconds, 30);
    // Same visitor on another day: daily unique counts must not be summed.
    await db.query("insert into public.site_activity values ($1, $2, '/cards', 3, 0)", [guestSession, yesterday]);
    const getReport = async (start, end) => (await authed(player, 'select public.admin_dashboard($1, $2) as report', [start, end]))[0].report;
    const report = await getReport(today, tomorrow);
    assert.equal(report.current.visitors, 2);
    assert.equal(report.current.users, 1);
    assert.equal(report.current.sessions, 2);
    assert.equal(report.current.pageviews, 3);
    assert.equal(report.current.engagementSeconds, 15);
    assert.equal(report.current.engagementRate, 100);
    assert.equal(report.previous.pageviews, 3);
    assert.equal(report.previous.visitors, 1);
    assert.equal(report.liveVisitors, 2);
    assert.equal(report.liveUsers, 1);
    assert.equal(report.activeUsers.daily, 1);
    assert.equal(report.activeUsers.weekly, 1);
    assert.equal(report.activeUsers.monthly, 1);
    assert.equal(report.registeredUsers, 3);
    assert.equal(report.newUsers, 3);
    assert.equal(report.daily.length, 1);
    assert.equal(report.daily[0].day, today);
    assert.equal(report.pages.reduce((sum, row) => sum + row.value, 0), 3);
    assert.deepEqual(report.devices, [{ name: 'desktop', value: 1 }, { name: 'mobile', value: 1 }]);
    assert.equal(report.audit.length, 3);
    assert.ok(report.audit.every(event => event.actor_id === null && event.action.endsWith('_backend')));
    const twoDays = await getReport(yesterday, tomorrow);
    assert.equal(twoDays.current.visitors, 2);
    assert.equal(twoDays.current.pageviews, 6);
    assert.equal(twoDays.daily.length, 2);
    assert.equal(twoDays.daily.reduce((sum, row) => sum + row.visitors, 0), 3);
    const emptyDay = await getReport('2000-01-01', '2000-01-02');
    assert.deepEqual(emptyDay.current, { visitors: 0, users: 0, sessions: 0, pageviews: 0, engagementSeconds: 0, engagementRate: 0 });
    assert.deepEqual(emptyDay.daily, [{ day: '2000-01-01', visitors: 0, users: 0, pageviews: 0 }]);
    for (const range of [[null, tomorrow], [today, today], [tomorrow, today], ['2000-01-01', tomorrow], ['2999-01-01', '2999-01-02']]) {
      await assert.rejects(getReport(...range), /Choose a period/);
    }
    const users = (await authed(player, "select public.admin_users('Site owner', 0) as result"))[0].result;
    assert.equal(users.total, 1);
    assert.equal(users.users[0].id, owner);
    assert.equal(users.users[0].is_admin, false);
    assert.ok(users.users[0].last_seen_at);
    assert.ok(!('email' in users.users[0]));
    assert.ok(!JSON.stringify(report).includes('private.test'));
    assert.ok(!JSON.stringify(report).includes(visitor));
    assert.equal((await authed(player, "select public.admin_users('', 25) as result"))[0].result.users.length, 0);
    await assert.rejects(authed(player, "select public.admin_users('', -1)"), /Invalid search/);
    await assert.rejects(authed(player, 'select email from auth.users'), /permission denied/);
    await assert.rejects(authed(player, 'select * from public.site_sessions'), /permission denied/);
    await db.exec("insert into public.site_sessions(id, visitor_id, device, referrer, started_at, last_seen_at) values (gen_random_uuid(), gen_random_uuid(), 'desktop', '', now() - interval '400 days', now() - interval '400 days')");
    await db.exec('select public.prune_site_analytics()');
    assert.equal((await db.query('select count(*)::int as n from public.site_sessions')).rows[0].n, 2);
  } finally { await db.close(); }
});

test('upgrade removes legacy code activation and browser grants while preserving existing admins', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create table public.site_admins(user_id uuid primary key);
      create table public.admin_audit(actor_id uuid, target_id uuid, action text);
      create table public.admin_setup(code_hash bytea);
      create function public.claim_site_admin(text) returns void language sql as $$ select $$;
      create function public.create_admin_setup_code() returns text language sql as $$ select 'legacy'::text $$;
      create function public.set_site_admin(uuid, boolean) returns void language sql as $$ select $$;
      grant execute on function public.set_site_admin(uuid, boolean) to anon, authenticated;
    `);
    await db.query('insert into public.site_admins values ($1)', [owner]);
    await db.exec(await readFile(new URL('../migrations/202611190002_backend_admin_roles.sql', import.meta.url), 'utf8'));
    assert.equal((await db.query('select user_id from public.site_admins')).rows[0].user_id, owner);
    assert.deepEqual((await db.query("select to_regprocedure('public.claim_site_admin(text)') as claim, to_regprocedure('public.create_admin_setup_code()') as setup, to_regclass('public.admin_setup') as codes")).rows[0], { claim: null, setup: null, codes: null });
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query("select has_function_privilege($1, 'public.set_site_admin(uuid,boolean)', 'EXECUTE') as allowed", [role])).rows[0].allowed, false);
    }
  } finally { await db.close(); }
});
