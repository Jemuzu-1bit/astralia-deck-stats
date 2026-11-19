import { useCallback, useEffect, useState } from 'react';
import type { AuthSession } from './useAuthSession';
import { adminRpc } from '../services/adminService';

export interface SiteSession extends AuthSession {
  isAdmin: boolean; adminReady: boolean; adminError: string | null; refreshAdmin: () => void;
}

export default function useAdminAccess(userId: string | undefined) {
  const [version, setVersion] = useState(0);
  const refreshAdmin = useCallback(() => setVersion(value => value + 1), []);
  const [state, setState] = useState<{ id: string | undefined; ready: boolean; allowed: boolean; error: string | null }>({ id: undefined, ready: true, allowed: false, error: null });
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void adminRpc<boolean>('is_site_admin').then(allowed => {
      if (active) setState({ id: userId, ready: true, allowed, error: null });
    }).catch((error: unknown) => {
      if (active) setState({ id: userId, ready: true, allowed: false, error: error instanceof Error ? error.message : 'Could not check admin access.' });
    });
    return () => { active = false; };
  }, [userId, version]);
  useEffect(() => {
    if (!userId) return;
    window.addEventListener('focus', refreshAdmin);
    const timer = window.setInterval(refreshAdmin, 60_000);
    return () => { window.removeEventListener('focus', refreshAdmin); window.clearInterval(timer); };
  }, [userId, refreshAdmin]);
  return { isAdmin: !!userId && state.id === userId && state.allowed,
    adminReady: !userId || (state.id === userId && state.ready),
    adminError: userId && state.id === userId ? state.error : null, refreshAdmin };
}
