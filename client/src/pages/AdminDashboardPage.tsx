import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import type { SiteSession } from '../hooks/useAdminAccess';
import { loadAdminUsers, loadDashboard } from '../services/adminService';
import type { AdminUser, Breakdown, DashboardData, PeriodMetrics } from '../services/adminService';
import { CHRONICLES } from '../data/chronicles';
import ArchiveIcon from '../components/ArchiveIcon';
import styles from './AdminDashboardPage.module.scss';

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
function presetRange(days: number) {
  const end = new Date(); end.setUTCHours(0, 0, 0, 0); end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - days);
  return { start: dateKey(start), end: dateKey(end) };
}
function shiftDay(value: string, days: number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return dateKey(date); }
const number = (value: number) => new Intl.NumberFormat().format(value);
const timestamp = (value: string | null) => value ? new Date(value).toLocaleString() : 'Not recorded';

function Change({ current, previous }: { current: number; previous: number }) {
  if (!previous) return <small>{current ? 'No previous activity' : 'No change'}</small>;
  const percent = Math.round((current - previous) / previous * 100);
  return <small>{percent > 0 ? '+' : ''}{percent}% vs previous period</small>;
}
function Metric({ label, value, hint, metric, data, format }: {
  label: string; value?: number; hint?: string; metric?: keyof PeriodMetrics; data?: DashboardData; format?: (value: number) => string;
}) {
  const current = metric && data ? data.current[metric] : value ?? 0;
  return <article className={styles.metric}><span>{label}</span><strong>{format ? format(current) : number(current)}</strong>
    {metric && data ? <Change current={current} previous={data.previous[metric]} /> : <small>{hint}</small>}
  </article>;
}
function BreakdownPanel({ title, rows, hint, chronicleNames = false }: { title: string; rows: Breakdown[]; hint: string; chronicleNames?: boolean }) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return <section className={styles.panel}><h2>{title}</h2><p className={styles.muted}>{hint}</p>
    {rows.length ? <ul className={styles.breakdown}>{rows.map(row => <li key={row.name}>
      <div><span>{chronicleNames ? CHRONICLES[row.name]?.name ?? row.name : row.name}</span><strong>{number(row.value)}</strong></div>
      <div className={styles.track} aria-hidden="true"><span style={{ width: `${row.value / max * 100}%` }} /></div>
    </li>)}</ul> : <p className={styles.empty}>No activity in this period.</p>}
  </section>;
}
function Trend({ rows }: { rows: DashboardData['daily'] }) {
  const [metric, setMetric] = useState<'visitors' | 'users' | 'pageviews'>('visitors');
  const chart = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(980);
  useEffect(() => {
    if (!chart.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    observer.observe(chart.current);
    return () => observer.disconnect();
  }, []);
  const max = Math.max(1, ...rows.map(row => row[metric]));
  const right = width - 16;
  const points = rows.map((row, index) => `${46 + index / Math.max(1, rows.length - 1) * (right - 46)},${205 - row[metric] / max * 170}`);
  return <section className={styles.panel}>
    <div className={styles.panelHeading}><div><h2>Activity over time</h2><p className={styles.muted}>Daily totals · UTC</p></div>
      <label className={styles.inlineLabel}>Show <select value={metric} onChange={event => setMetric(event.target.value as typeof metric)}><option value="visitors">Unique visitors</option><option value="users">Signed-in users</option><option value="pageviews">Page views</option></select></label>
    </div>
    <svg ref={chart} viewBox={`0 0 ${width} 240`} className={styles.chart} role="img" aria-label={`${metric} per day. Exact values are in the daily data table below.`}>
      {[0, .5, 1].map(tick => <g key={tick}><line x1="46" x2={right} y1={205 - tick * 170} y2={205 - tick * 170} stroke="#30323b" /><text x="5" y={210 - tick * 170}>{new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(max * tick))}</text></g>)}
      <polygon points={`46,205 ${points.join(' ')} ${rows.length > 1 ? right : '46'},205`} fill="#ddbd7d15" />
      <polyline points={points.join(' ')} fill="none" stroke="#ddbd7d" strokeWidth="3" strokeLinejoin="round" />
      {rows.length === 1 && <circle cx="46" cy={205 - rows[0][metric] / max * 170} r="4" fill="#ddbd7d" />}
      <text x="46" y="233">{rows[0]?.day}</text><text x={right} y="233" textAnchor="end">{rows.length > 1 ? rows.at(-1)?.day : ''}</text>
    </svg>
    <details><summary>View daily data</summary><div className={styles.tableWrap}><table><thead><tr><th scope="col">Day (UTC)</th><th scope="col">Visitors</th><th scope="col">Signed-in users</th><th scope="col">Page views</th></tr></thead><tbody>{rows.map(row => <tr key={row.day}><th scope="row">{row.day}</th><td>{number(row.visitors)}</td><td>{number(row.users)}</td><td>{number(row.pageviews)}</td></tr>)}</tbody></table></div></details>
  </section>;
}
function exportDaily(data: DashboardData) {
  const csv = ['day_utc,unique_visitors,signed_in_users,pageviews', ...data.daily.map(row => [row.day, row.visitors, row.users, row.pageviews].join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `astralia-analytics-${data.daily[0]?.day}-${data.daily.at(-1)?.day}.csv`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function UserDirectory({ session }: { session: SiteSession }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ search: '', offset: 0 });
  const [result, setResult] = useState<{ total: number; users: AdminUser[] } | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setResult(null);
    void loadAdminUsers(query.search, query.offset).then(data => { if (active) setResult(data); }).catch((error: unknown) => {
      if (active) { setError(error instanceof Error ? error.message : 'Could not load users.'); session.refreshAdmin(); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, version, session.refreshAdmin]);
  return <section className={styles.panel}>
    <h2>Registered users</h2><p className={styles.muted}>Search registered players and view their activity. Administrator roles are assigned only from the backend.</p>
    <form className={styles.search} onSubmit={event => { event.preventDefault(); setQuery({ search: search.trim(), offset: 0 }); }}>
      <label htmlFor="admin-user-search">Player name or exact user ID</label><div><input id="admin-user-search" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} /><button>Search users</button></div>
    </form>
    {error && <div role="alert"><p className={styles.error}>{error}</p><button onClick={() => setVersion(value => value + 1)}>Retry</button></div>}
    {loading ? <p role="status">Loading registered players...</p> : result && <>
      <div className={styles.tableWrap}><table><thead><tr><th scope="col">Player</th><th scope="col">Joined</th><th scope="col">Last measured activity</th><th scope="col">Role</th></tr></thead><tbody>
        {result.users.map(user => <tr key={user.id}><th scope="row"><strong>{user.name}{session.user?.id === user.id ? ' (you)' : ''}</strong><code>{user.id}</code></th><td>{timestamp(user.created_at)}</td><td>{timestamp(user.last_seen_at)}</td><td><span className={user.is_admin ? styles.badge : undefined}>{user.is_admin ? 'Admin' : 'Player'}</span></td></tr>)}
      </tbody></table></div>
      {!result.users.length && <p className={styles.empty}>No players match this search.</p>}
      <div className={styles.pagination}><span>{number(result.total)} {result.total === 1 ? 'player' : 'players'}{result.total > 0 && ` · ${query.offset + 1}–${Math.min(query.offset + 25, result.total)}`}</span><div><button disabled={query.offset === 0} onClick={() => setQuery(value => ({ ...value, offset: Math.max(0, value.offset - 25) }))}>Previous</button><button disabled={query.offset + 25 >= result.total} onClick={() => setQuery(value => ({ ...value, offset: value.offset + 25 }))}>Next</button></div></div>
    </>}
  </section>;
}

function Dashboard({ session }: { session: SiteSession }) {
  const [range, setRange] = useState(() => presetRange(30));
  const [draftStart, setDraftStart] = useState(range.start);
  const [draftEnd, setDraftEnd] = useState(shiftDay(range.end, -1));
  const [selectedPreset, setSelectedPreset] = useState<number | null>(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true; let pending = false;
    setData(null);
    const refresh = async () => {
      if (pending) return;
      pending = true; setLoading(true);
      try { const result = await loadDashboard(range.start, range.end); if (active) { setData(result); setError(null); } }
      catch (error) { if (active) { setData(null); setError(error instanceof Error ? error.message : 'Could not load dashboard.'); session.refreshAdmin(); } }
      finally { pending = false; if (active) setLoading(false); }
    };
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [range, version, session.refreshAdmin]);
  const choosePreset = (days: number) => {
    const next = presetRange(days); setRange(next); setDraftStart(next.start); setDraftEnd(shiftDay(next.end, -1)); setSelectedPreset(days); setRangeError(null);
  };
  const applyRange = (event: FormEvent) => {
    event.preventDefault();
    const days = (Date.parse(draftEnd) - Date.parse(draftStart)) / 86_400_000 + 1;
    if (!Number.isFinite(days) || days < 1 || days > 366 || draftEnd > dateKey(new Date())) { setRangeError('Choose 1 to 366 days, ending no later than today.'); return; }
    setRangeError(null); setSelectedPreset(null); setRange({ start: draftStart, end: shiftDay(draftEnd, 1) });
  };
  return <div className={styles.page}>
    <header className={styles.header}><div><span className={styles.eyebrow}>ADMINISTRATOR WORKSPACE</span><h1>Site monitoring</h1><p className={styles.muted}>Understand visits, community growth and how the archive is used.</p></div><span className={styles.badge}><ArchiveIcon name="lock" size={16} /> Admin access</span></header>
    <section className={styles.filters} aria-label="Dashboard date range">
      <div className={styles.presets}>{[7, 30, 90].map(days => <button key={days} aria-pressed={selectedPreset === days} onClick={() => choosePreset(days)}>Last {days} days</button>)}</div>
      <form onSubmit={applyRange}><label>From<input type="date" required max={dateKey(new Date())} value={draftStart} onChange={event => setDraftStart(event.target.value)} /></label><label>Through<input type="date" required max={dateKey(new Date())} value={draftEnd} onChange={event => setDraftEnd(event.target.value)} /></label><button>Apply dates</button></form>
      {rangeError && <p className={styles.error} role="alert">{rangeError}</p>}
    </section>
    <div className={styles.statusBar}><span>Report: {range.start} – {shiftDay(range.end, -1)} · UTC · compared with the previous {Math.round((Date.parse(range.end) - Date.parse(range.start)) / 86_400_000)} days</span><div className={styles.actions}><button onClick={() => setVersion(value => value + 1)} disabled={loading}><ArchiveIcon name="refresh" size={16} /> Refresh</button><button onClick={() => data && exportDaily(data)} disabled={!data || loading}>Export daily CSV</button></div></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading && <p role="status">Updating monitoring data...</p>}
    {data && <>
      <section className={styles.live}><div><span className={styles.eyebrow}>ACTIVE IN THE LAST 5 MINUTES</span><p><strong>{number(data.liveVisitors)}</strong> visitors <span>including {number(data.liveUsers)} signed-in users</span></p></div><small>Refreshes every minute while visible<br />Updated {timestamp(data.generatedAt)}</small></section>
      <div className={styles.metrics}>
        <Metric label="Unique visitors" metric="visitors" data={data} />
        <Metric label="Unique signed-in users" metric="users" data={data} />
        <Metric label="Visits" metric="sessions" data={data} />
        <Metric label="Page views" metric="pageviews" data={data} />
        <Metric label="Average measured engagement / visit" metric="engagementSeconds" data={data} format={value => `${Math.floor(value / 60)}m ${value % 60}s`} />
        <Metric label="Engaged visits" metric="engagementRate" data={data} format={value => `${value}%`} />
        <Metric label="New registered users" value={data.newUsers} hint="Accounts created in the selected period" />
        <Metric label="Registered users" value={data.registeredUsers} hint="All accounts · independent of usage consent" />
      </div>
      <div className={styles.coverage}><p>Traffic includes only visitors who allow usage statistics. {data.trackingSince ? `Recorded traffic begins ${timestamp(data.trackingSince)}; earlier periods are incomplete.` : 'No traffic recorded yet. Past traffic cannot be reconstructed.'}</p><details><summary>Definitions and coverage</summary><p>Unique signed-in users are distinct accounts; guests are distinct consenting browsers. A person using multiple browsers or signing in after browsing may count more than once. Visits restart after 30 minutes of inactivity or an account change. Hidden or unfocused tabs do not send heartbeats; presence expires after 5 minutes.</p><p>Engaged visits have at least 10 measured seconds or 2 page views in the selected period. Engagement is an estimate sampled every 30 seconds; short visits can record zero. Daily unique counts should not be added together. Admin and personal profile pages are excluded.</p></details></div>
      <Trend rows={data.daily} />
      <div className={styles.columns}><BreakdownPanel title="Top pages" rows={data.pages} hint="Page views in the selected period" /><BreakdownPanel title="Traffic sources" rows={data.referrers} hint="Visits by referring hostname · no URL parameters" /><BreakdownPanel title="Devices" rows={data.devices} hint="Visits by approximate device category" /></div>
      <section className={styles.panel}><h2>Community & content</h2><p className={styles.muted}>Account and content totals come from the database. Activity counts include consenting signed-in users only.</p><div className={styles.metrics}>
        <Metric label="Daily active users" value={data.activeUsers.daily} hint="Today (UTC) · independent of report dates" />
        <Metric label="Weekly active users" value={data.activeUsers.weekly} hint="Today and the previous 6 days" />
        <Metric label="Monthly active users" value={data.activeUsers.monthly} hint="Today and the previous 29 days" />
        <Metric label="Saved cloud decks" value={data.totalDecks} hint={`${number(data.publicDecks)} public · ${number(data.totalDecks - data.publicDecks)} private · all time`} />
        <Metric label="New cloud decks" value={data.newDecks} hint="Created in the selected period" />
        <Metric label="New comments" value={data.newComments} hint="Created in the selected period" />
      </div></section>
      <BreakdownPanel title="Decks by chronicle" rows={data.chronicles} hint="All saved cloud decks · all time" chronicleNames />
    </>}
    <UserDirectory session={session} />
    {data && <section className={styles.panel}><h2>Administrator activity</h2><p className={styles.muted}>The 20 most recent role changes · all time</p><div className={styles.tableWrap}><table><thead><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Administrator</th><th scope="col">Target account</th></tr></thead><tbody>{data.audit.map(event => <tr key={event.id}><td>{timestamp(event.created_at)}</td><td>{event.action.replaceAll('_', ' ')}</td><td>{event.actor_name ?? (event.action.endsWith('_backend') ? 'Backend' : 'Deleted account')}</td><td><code>{event.target_id ?? 'Deleted account'}</code></td></tr>)}</tbody></table></div></section>}
  </div>;
}

export default function AdminDashboardPage() {
  const session = useOutletContext<SiteSession>();
  if (!session.authReady || !session.adminReady) return <div className={styles.page}><p role="status">Checking administrator access...</p></div>;
  if (!session.isAdmin) return <div className={styles.page}><ArchiveIcon name="lock" size={32} /><h1>Administrator access required</h1><p>{session.user ? 'Your account does not have access to site monitoring.' : 'Sign in with an administrator account to view site monitoring.'}</p>{session.adminError && <p className={styles.error} role="alert">{session.adminError}</p>}<div className={styles.actions}><Link to="/profile" className={styles.primary}>Go to your profile</Link>{session.user && <button onClick={session.refreshAdmin}>Check access again</button>}</div></div>;
  return <Dashboard key={session.user?.id} session={session} />;
}
