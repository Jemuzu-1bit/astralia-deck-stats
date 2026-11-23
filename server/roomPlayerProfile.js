const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function discordAvatar(value) {
  try {
    const url = new URL(value);
    return url.origin === "https://cdn.discordapp.com" && (url.pathname.startsWith("/avatars/")
      || url.pathname.startsWith("/embed/avatars/")) ? url.href : "";
  } catch { return ""; }
}

export async function getRoomPlayerProfile(accessToken) {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || typeof accessToken !== "string" || !accessToken || accessToken.length > 8192) return null;

  const base = url.replace(/\/+$/, "");
  const options = {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(4000),
    redirect: "error",
  };
  try {
    const identity = await fetch(`${base}/auth/v1/user`, options);
    if (!identity.ok) return null;
    const user = await identity.json();
    if (!uuid.test(user.id) || !user.identities?.some(item => item.provider === "discord")) return null;

    const query = new URLSearchParams({ id: `eq.${user.id}`,
      select: "name,avatar,favorite_chronicle,appearance,discord_appearance" });
    const response = await fetch(`${base}/rest/v1/player_profiles?${query}`, options);
    if (!response.ok) return null;
    const [profile] = await response.json();
    const name = profile?.name?.trim();
    if (!name) return null;
    const { cover, coverColor, showAvatarDecoration, showNameplate, showGuildTag, effect } = profile.appearance ?? {};
    return {
      name,
      avatar: discordAvatar(profile.avatar),
      favoriteChronicle: profile.favorite_chronicle,
      appearance: { cover, coverColor, showAvatarDecoration, showNameplate, showGuildTag, effect },
      discord: profile.discord_appearance,
    };
  } catch {
    return null;
  }
}
