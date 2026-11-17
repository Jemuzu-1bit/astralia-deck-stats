import type { User } from "@supabase/supabase-js";

function text(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? "";
}

export function profileWebsite(value: string): string {
  if (!value.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch { /* Invalid links are never rendered as clickable URLs. */ }
  throw new Error("Enter a valid website or social link starting with https:// or http://.");
}

export function getPlayerProfile(user: User) {
  const metadata = { ...user.user_metadata, ...user.identities?.find(identity => identity.provider === "discord")?.identity_data };
  const profile = user.user_metadata?.player_profile;
  let website = "";
  try { website = profileWebsite(text(profile?.website)); } catch { /* Ignore invalid saved links. */ }
  return {
    name: text(metadata.custom_claims?.global_name, metadata.global_name, metadata.full_name, metadata.name, metadata.preferred_username, metadata.user_name) || "Discord user",
    avatar: text(metadata.avatar_url, metadata.picture),
    bio: text(profile?.bio).slice(0, 300),
    favoriteChronicle: text(profile?.favoriteChronicle),
    website,
  };
}
