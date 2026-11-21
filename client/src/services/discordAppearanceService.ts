import { readDiscordProfileResponse } from "../domain/playerProfile";
import { supabase } from "./supabaseClient";

const RECONNECT_KEY = "astralia:discord-profile-reconnect";

export class DiscordReconnectRequired extends Error {}

export async function syncDiscordAppearance(userId: string) {
  if (!supabase) throw new Error("Discord sign-in is not configured.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (session?.user.id !== userId) throw new Error("Your sign-in has changed. Open your profile again.");
  if (!session.provider_token) throw new DiscordReconnectRequired();

  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${session.provider_token}` },
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401 || response.status === 403) throw new DiscordReconnectRequired();
  if (!response.ok) throw new Error("Discord could not load your profile. Try again in a moment.");

  const appearance = readDiscordProfileResponse(await response.json());
  const identity = session.user.identities?.find(item => item.provider === "discord");
  const discordId = identity?.identity_data?.sub ?? identity?.identity_id ?? session.user.user_metadata?.provider_id;
  if (!appearance.id || appearance.id !== discordId) {
    throw new Error("Discord returned a different account. Reconnect with your linked Discord account.");
  }
  const current = await supabase.auth.getSession();
  if (current.error) throw current.error;
  if (current.data.session?.user.id !== userId) throw new Error("Your sign-in has changed. Open your profile again.");

  const saved = await supabase.auth.updateUser({ data: { discord_profile: appearance } });
  if (saved.error) throw saved.error;
  return appearance;
}

export async function reconnectDiscordAppearance(userId: string, draft: unknown) {
  if (!supabase) throw new Error("Discord sign-in is not configured.");
  sessionStorage.setItem(RECONNECT_KEY, JSON.stringify({ userId, draft }));
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/my-decks`, queryParams: { prompt: "consent" } },
    });
    if (error) throw error;
  } catch (error) {
    sessionStorage.removeItem(RECONNECT_KEY);
    throw error;
  }
}

export function takeDiscordAppearanceDraft(userId?: string): { draft: unknown } | null {
  try {
    const value = sessionStorage.getItem(RECONNECT_KEY);
    if (!value) return null;
    sessionStorage.removeItem(RECONNECT_KEY);
    const { userId: owner, draft } = JSON.parse(value);
    return userId && owner === userId ? { draft } : null;
  } catch {
    return null;
  }
}
