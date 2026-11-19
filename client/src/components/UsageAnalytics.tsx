import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useAuthSession from '../hooks/useAuthSession';
import { supabase } from '../services/supabaseClient';
import { ANALYTICS_CHANGE, analyticsConsent, privacySignal, setAnalyticsConsent } from '../services/analyticsPreferences';
import styles from './UsageAnalytics.module.scss';

// Never send deck IDs, room codes, searches, profile data, or query strings.
function analyticsPath(path: string) {
  if (path.startsWith('/players/')) return '/players/:id';
  if (/^\/lobby(?:\/|$)/.test(path)) return '/lobby';
  if (/^\/game(?:\/|$)/.test(path)) return '/game';
  return ['/', '/cards', '/my-decks', '/public-decks', '/multiplayer', '/help'].includes(path) ? path : null;
}

export function AnalyticsPreference() {
  const [enabled, setEnabled] = useState(analyticsConsent);
  useEffect(() => {
    const refresh = () => setEnabled(analyticsConsent());
    window.addEventListener(ANALYTICS_CHANGE, refresh);
    return () => window.removeEventListener(ANALYTICS_CHANGE, refresh);
  }, []);
  return <button type="button" onClick={() => { setAnalyticsConsent(!enabled); }} disabled={privacySignal()}>
    Usage statistics: {enabled && !privacySignal() ? 'on' : 'off'}{privacySignal() ? ' (browser privacy preference)' : ''}
  </button>;
}

export default function UsageAnalytics() {
  const { pathname } = useLocation();
  const { user, authReady } = useAuthSession();
  const [consent, setConsent] = useState(analyticsConsent);
  const path = analyticsPath(pathname);
  const userId = user?.id;
  useEffect(() => {
    const refresh = () => setConsent(analyticsConsent());
    window.addEventListener(ANALYTICS_CHANGE, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(ANALYTICS_CHANGE, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  useEffect(() => {
    if (!supabase || !authReady || !consent || privacySignal() || !path) return;
    const client = supabase;
    let stopped = false;
    let sending = false;
    let pendingPageview = true;
    let lastSent = Date.now();
    let lastInteraction = Date.now();
    const onInteraction = () => { lastInteraction = Date.now(); };
    const send = async () => {
      if (stopped || sending || document.visibilityState !== 'visible' || !document.hasFocus()
        || Date.now() - lastInteraction > 5 * 60_000) return;
      sending = true;
      try {
        let visitor = localStorage.getItem('astralia-visitor');
        if (!visitor) { visitor = crypto.randomUUID(); localStorage.setItem('astralia-visitor', visitor); }
        const raw = sessionStorage.getItem('astralia-analytics-session');
        let session = raw ? JSON.parse(raw) as { id: string; identity: string; lastAt: number } : null;
        const identity = userId ?? 'guest';
        if (!session || session.identity !== identity || Date.now() - session.lastAt >= 30 * 60_000) {
          session = { id: crypto.randomUUID(), identity, lastAt: Date.now() };
          pendingPageview = true;
        }
        session.lastAt = Date.now();
        sessionStorage.setItem('astralia-analytics-session', JSON.stringify(session));
        let referrer = '';
        try { const url = new URL(document.referrer); if (url.hostname !== location.hostname) referrer = url.hostname; } catch { /* Direct visit. */ }
        const { error } = await client.rpc('track_site_activity', {
          p_session: session.id, p_visitor: visitor, p_path: path, p_pageview: pendingPageview,
          p_seconds: Math.min(30, Math.max(0, Math.floor((Date.now() - lastSent) / 1000))),
          p_device: /iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : /Mobi/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
          p_referrer: referrer,
        });
        if (!error) pendingPageview = false;
        lastSent = Date.now();
      } catch { /* Telemetry must never interrupt site use. */ }
      finally { sending = false; }
    };
    const onVisibility = () => { lastSent = Date.now(); if (document.visibilityState === 'visible') { onInteraction(); void send(); } };
    // Defer the first send so React StrictMode's discarded effect cannot count a view.
    const first = window.setTimeout(() => { void send(); }, 250);
    const timer = window.setInterval(() => { void send(); }, 30_000);
    window.addEventListener('pointerdown', onInteraction);
    window.addEventListener('keydown', onInteraction);
    window.addEventListener('scroll', onInteraction, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      stopped = true; window.clearTimeout(first); window.clearInterval(timer);
      window.removeEventListener('pointerdown', onInteraction); window.removeEventListener('keydown', onInteraction);
      window.removeEventListener('scroll', onInteraction); window.removeEventListener('focus', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [authReady, userId, consent, path]);
  if (!supabase || consent !== null || privacySignal()) return null;
  return <aside className={styles.notice} aria-label="Usage statistics preference">
    <p><strong>Help improve the Deck Archive</strong><br />Allow usage statistics for visits, pages and time spent here? If you sign in, activity is linked to your account. No IP addresses or full URLs are stored. You can change this in Settings.</p>
    <div><button onClick={() => setAnalyticsConsent(false)}>No thanks</button><button onClick={() => setAnalyticsConsent(true)}>Allow statistics</button></div>
  </aside>;
}
