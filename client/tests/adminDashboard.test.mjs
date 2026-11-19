// Browser integration checks with isolated API fixtures, never the live database.
// Start Vite locally, then run:
// node --env-file=client/.env.local client/tests/adminDashboard.test.mjs
// Set ADMIN_UI_TEST_RUNTIME to a temp npm prefix containing playwright-core.
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';

const runtime = process.env.ADMIN_UI_TEST_RUNTIME;
if (!runtime) throw new Error('Set ADMIN_UI_TEST_RUNTIME to the npm prefix containing playwright-core.');
const { chromium } = await import(pathToFileURL(join(runtime, 'node_modules/playwright-core/index.mjs')).href);
const base = process.env.ADMIN_UI_BASE_URL ?? 'http://127.0.0.1:5173';
const service = process.env.VITE_SUPABASE_URL;
if (!service) throw new Error('Load the frontend environment to intercept Supabase requests.');
const serviceOrigin = new URL(service).origin;
const ownerId = '10000000-0000-4000-8000-000000000001';
const playerId = '20000000-0000-4000-8000-000000000002';
const user = { id: ownerId, aud: 'authenticated', role: 'authenticated', email: 'owner@example.test', app_metadata: { provider: 'discord' }, user_metadata: { full_name: 'Site owner' }, created_at: new Date().toISOString() };
const accessToken = ['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', Buffer.from(JSON.stringify({ sub: ownerId, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'), 'test-signature'].join('.');
const tokenKey = `sb-${new URL(service).hostname.split('.')[0]}-auth-token`;
const session = { access_token: accessToken, refresh_token: 'test-refresh-token', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user };
const artifacts = join(runtime, 'screenshots');
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.ADMIN_UI_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true, timeout: 30_000 });
const failures = [];
const contexts = [];

async function setup({ admin = false, loggedIn = true, consent = 'no', width = 1440, doNotTrack = false } = {}) {
  const state = { admin, dashboardCalls: 0, roleCalls: 0, tracks: [], reports: [] };
  const context = await browser.newContext({ viewport: { width, height: 1000 }, acceptDownloads: true });
  contexts.push(context);
  await context.addInitScript(({ tokenKey, session, loggedIn, consent, doNotTrack }) => {
    if (consent !== null) localStorage.setItem('astralia-usage-consent', consent);
    if (doNotTrack) Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
    if (loggedIn) localStorage.setItem(tokenKey, JSON.stringify(session));
  }, { tokenKey, session, loggedIn, consent, doNotTrack });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin) return route.continue();
    if (url.origin !== serviceOrigin) return route.abort();
    const rpc = url.pathname.split('/').at(-1);
    const params = route.request().postDataJSON() ?? {};
    const json = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.pathname.startsWith('/auth/')) return json(user);
    if (rpc === 'is_site_admin') return json(state.admin);
    if (rpc === 'set_site_admin' || rpc === 'claim_site_admin' || rpc === 'create_admin_setup_code') {
      state.roleCalls++; return json({ code: '42501', message: 'Browser role assignment is disabled.' }, 403);
    }
    if (rpc === 'track_site_activity') { state.tracks.push(params); return json(null); }
    if (rpc === 'admin_users') {
      if (!state.admin) return json({ code: '42501', message: 'Administrator access required.' }, 403);
      const users = [
        { id: ownerId, name: 'Site owner', created_at: user.created_at, last_seen_at: user.created_at, is_admin: true },
        { id: playerId, name: 'Test player', created_at: user.created_at, last_seen_at: null, is_admin: false },
      ].filter(user => user.name.toLowerCase().includes(params.p_search.toLowerCase()) || user.id === params.p_search);
      return json({ total: users.length, users: params.p_offset ? [] : users });
    }
    if (rpc === 'admin_dashboard') {
      if (!state.admin) return json({ code: '42501', message: 'Administrator access required.' }, 403);
      state.dashboardCalls++; state.reports.push(params);
      const daily = [];
      for (let d = new Date(`${params.p_start}T00:00:00Z`); d < new Date(`${params.p_end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
        daily.push({ day: d.toISOString().slice(0, 10), visitors: 2 + daily.length % 7, users: 1, pageviews: 5 + daily.length % 9 });
      }
      return json({ current: { visitors: 42, users: 12, sessions: 56, pageviews: 180, engagementSeconds: 70, engagementRate: 62.5 },
        previous: { visitors: 21, users: 6, sessions: 28, pageviews: 90, engagementSeconds: 35, engagementRate: 50 },
        generatedAt: new Date().toISOString(), trackingSince: new Date().toISOString(), liveVisitors: 4, liveUsers: 2,
        registeredUsers: 15, newUsers: 3, totalDecks: 24, publicDecks: 10, newDecks: 8, newComments: 5,
        activeUsers: { daily: 2, weekly: 7, monthly: 12 }, daily,
        pages: [{ name: '/cards', value: 42 }], devices: [{ name: 'desktop', value: 30 }], referrers: [{ name: 'Direct / unknown', value: 30 }], chronicles: [{ name: 'blue', value: 12 }],
        audit: [{ id: 1, action: 'admin_granted_backend', actor_id: null, actor_name: null, target_id: ownerId, created_at: new Date().toISOString() }],
      });
    }
    // No unmatched request may leave the browser test for the production API.
    return json({ message: 'Unexpected API request blocked by UI test.' }, 400);
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60_000);
  page.setDefaultTimeout(15_000);
  page.on('pageerror', error => failures.push(error.message));
  return { page, state, context };
}

try {
  const denied = await setup();
  await denied.page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
  await denied.page.getByRole('heading', { name: 'Administrator access required' }).waitFor();
  assert.equal(denied.state.dashboardCalls, 0);
  assert.equal(await denied.page.getByRole('link', { name: 'Admin dashboard', exact: true }).count(), 0);
  console.log('PASS: non-admin route and navigation are protected');

  const active = await setup({ admin: true });
  const { page, state } = active;
  await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Activity over time' }).waitFor();
  await page.getByText('Test player', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /Make admin|Revoke admin|Confirm role change/ }).count(), 0);
  const dashboardLink = page.getByRole('region', { name: 'Discord profile', exact: true }).getByRole('link', { name: 'Admin dashboard', exact: true });
  await dashboardLink.waitFor();
  assert.ok(await dashboardLink.evaluate(link => link.nextElementSibling?.tagName === 'DETAILS'));
  assert.equal(await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link', { name: 'Admin dashboard', exact: true }).count(), 0);
  await page.getByRole('button', { name: 'Last 7 days', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('button[aria-pressed="true"]')?.textContent === 'Last 7 days');
  await page.getByRole('status').waitFor({ state: 'hidden' });
  assert.equal((Date.parse(state.reports.at(-1).p_end) - Date.parse(state.reports.at(-1).p_start)) / 86_400_000, 7);
  await page.getByText('View daily data', { exact: true }).click();
  assert.equal(await page.locator('details table tbody tr').count(), 7);
  const downloadWait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export daily CSV' }).click();
  assert.match((await downloadWait).suggestedFilename(), /^astralia-analytics-/);
  await page.getByRole('textbox', { name: 'Player name or exact user ID' }).fill('Site owner');
  await page.getByRole('button', { name: 'Search users' }).click();
  await page.getByText('1 player', { exact: false }).waitFor();
  await page.getByRole('status').waitFor({ state: 'hidden' });
  await page.screenshot({ path: join(artifacts, 'admin-dashboard-desktop.png'), fullPage: true });
  assert.equal(state.tracks.length, 0);
  assert.equal(state.roleCalls, 0);
  console.log('PASS: dashboard link is above the profile; roles are read-only; dates, CSV, search and opt-out work');
  state.admin = false;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('heading', { name: 'Administrator access required' }).waitFor();
  assert.equal(await page.getByRole('heading', { name: 'Activity over time' }).count(), 0);
  console.log('PASS: revoked administrator access clears the monitoring screen');

  const mobile = await setup({ admin: true, width: 390 });
  await mobile.page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
  await mobile.page.getByRole('heading', { name: 'Activity over time' }).waitFor();
  await mobile.page.getByText('Test player', { exact: true }).waitFor();
  const mobileLink = mobile.page.getByRole('region', { name: 'Discord profile', exact: true }).getByRole('link', { name: 'Admin dashboard', exact: true });
  const linkBox = await mobileLink.boundingBox();
  const profileBox = await mobile.page.getByLabel('Account menu for Site owner', { exact: true }).boundingBox();
  assert.ok(linkBox && profileBox && linkBox.y + linkBox.height <= profileBox.y);
  assert.equal(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.ok(await mobile.page.locator('svg[role="img"]').evaluate(svg => Math.abs(svg.viewBox.baseVal.width - svg.getBoundingClientRect().width) < 2));
  await mobile.page.screenshot({ path: join(artifacts, 'admin-dashboard-mobile.png'), fullPage: true });
  console.log('PASS: mobile dashboard fits a 390px viewport');

  const profile = await setup();
  await profile.page.goto(`${base}/profile`, { waitUntil: 'domcontentloaded' });
  await profile.page.getByRole('heading', { name: 'My profile', exact: true }).waitFor();
  assert.equal(await profile.page.getByText('Administrator activation', { exact: true }).count(), 0);
  assert.equal(await profile.page.getByLabel('Activation code', { exact: true }).count(), 0);
  assert.equal(await profile.page.getByRole('link', { name: 'Admin dashboard', exact: true }).count(), 0);
  assert.equal(profile.state.roleCalls, 0);
  console.log('PASS: player profiles have no activation code or administrator link');

  // A fresh opt-in visitor counts SPA navigation once per page under StrictMode.
  const telemetry = await setup({ loggedIn: false, consent: 'yes' });
  await telemetry.page.goto(`${base}/help`, { waitUntil: 'domcontentloaded' });
  await telemetry.page.bringToFront();
  await telemetry.page.waitForFunction(() => document.hasFocus());
  await telemetry.page.waitForTimeout(700);
  assert.equal(telemetry.state.tracks.filter(event => event.p_pageview).length, 1);
  assert.equal(telemetry.state.tracks[0].p_path, '/help');
  assert.ok(!('p_user_id' in telemetry.state.tracks[0]));
  await telemetry.page.getByRole('link', { name: 'Overview', exact: true }).click();
  await telemetry.page.waitForTimeout(700);
  assert.equal(telemetry.state.tracks.filter(event => event.p_pageview).length, 2);
  assert.equal(telemetry.state.tracks[1].p_path, '/');
  assert.equal(telemetry.state.tracks[0].p_session, telemetry.state.tracks[1].p_session);
  console.log('PASS: opt-in telemetry counts SPA routes once without account IDs in payload');
  await telemetry.page.getByRole('button', { name: 'Settings', exact: true }).click();
  await telemetry.page.getByRole('button', { name: 'Usage statistics: on', exact: true }).click();
  assert.equal(await telemetry.page.evaluate(() => localStorage.getItem('astralia-visitor')), null);
  await telemetry.page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await telemetry.page.getByRole('link', { name: 'How to play', exact: true }).click();
  await telemetry.page.waitForTimeout(700);
  assert.equal(telemetry.state.tracks.filter(event => event.p_pageview).length, 2);
  const privateBrowser = await setup({ loggedIn: false, consent: 'yes', doNotTrack: true });
  await privateBrowser.page.goto(`${base}/help`, { waitUntil: 'domcontentloaded' });
  await privateBrowser.page.waitForTimeout(700);
  assert.equal(privateBrowser.state.tracks.length, 0);
  console.log('PASS: disabling statistics stops collection; browser privacy preferences are respected');
  assert.deepEqual(failures, []);
  console.log(`UI checks passed. Screenshots: ${artifacts}`);
} finally {
  await Promise.all(contexts.map(context => context.close()));
  await browser.close();
}
