const KEY = 'astralia-usage-consent';
export const ANALYTICS_CHANGE = 'astralia-usage-consent-change';
export function analyticsConsent(): boolean | null {
  try { const value = localStorage.getItem(KEY); return value === 'yes' ? true : value === 'no' ? false : null; }
  catch { return false; }
}
export function privacySignal() {
  return navigator.doNotTrack === '1' || !!(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
}
export function setAnalyticsConsent(enabled: boolean) {
  try {
    localStorage.setItem(KEY, enabled ? 'yes' : 'no');
    if (!enabled) { localStorage.removeItem('astralia-visitor'); sessionStorage.removeItem('astralia-analytics-session'); }
  } catch { /* Analytics stays off when storage is blocked. */ }
  window.dispatchEvent(new Event(ANALYTICS_CHANGE));
}
