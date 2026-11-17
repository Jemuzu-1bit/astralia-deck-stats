import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../services/supabaseClient";

export interface AuthSession {
  user: User | null;
  authReady: boolean;
  authError: string | null;
}

export default function useAuthSession(): AuthSession {
  const [session, setSession] = useState<AuthSession>({ user: null, authReady: !supabase, authError: null });

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let receivedAuthEvent = false;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !receivedAuthEvent) {
        setSession({ user: data.session?.user ?? null, authReady: true, authError: error?.message ?? null });
      }
    }).catch((error: unknown) => {
      if (active && !receivedAuthEvent) {
        setSession({ user: null, authReady: true, authError: error instanceof Error ? error.message : "Could not load your account." });
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, authSession) => {
      receivedAuthEvent = true;
      if (active) setSession({ user: authSession?.user ?? null, authReady: true, authError: null });
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  return session;
}
