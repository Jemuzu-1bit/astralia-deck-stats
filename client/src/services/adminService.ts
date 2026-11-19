import { supabase } from './supabaseClient';

export interface PeriodMetrics {
  visitors: number; users: number; sessions: number; pageviews: number;
  engagementSeconds: number; engagementRate: number;
}
export interface Breakdown { name: string; value: number }
export interface DashboardData {
  current: PeriodMetrics; previous: PeriodMetrics; generatedAt: string; trackingSince: string | null;
  liveVisitors: number; liveUsers: number; registeredUsers: number; newUsers: number;
  totalDecks: number; publicDecks: number; newDecks: number; newComments: number;
  activeUsers: { daily: number; weekly: number; monthly: number };
  daily: { day: string; visitors: number; users: number; pageviews: number }[];
  pages: Breakdown[]; devices: Breakdown[]; referrers: Breakdown[]; chronicles: Breakdown[];
  audit: { id: number; action: string; actor_id: string | null; target_id: string | null; actor_name: string | null; created_at: string }[];
}
export interface AdminUser { id: string; name: string; created_at: string; last_seen_at: string | null; is_admin: boolean }

export async function adminRpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('Account services are not configured.');
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') throw new Error('Admin tools are not configured yet. Apply the admin monitoring database migration first.');
    throw new Error(error.message);
  }
  return data as T;
}

export const loadDashboard = (start: string, end: string) => adminRpc<DashboardData>('admin_dashboard', { p_start: start, p_end: end });
export const loadAdminUsers = (search: string, offset: number) => adminRpc<{ total: number; users: AdminUser[] }>('admin_users', { p_search: search, p_offset: offset });
