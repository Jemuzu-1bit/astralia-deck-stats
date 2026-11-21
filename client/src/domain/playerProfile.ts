import type { User } from "@supabase/supabase-js";

const DISCORD_CDN = "https://cdn.discordapp.com";
export const DEFAULT_PROFILE_COLOR = "#383027";
const HASH = /^(?:a_)?[a-f0-9]{32}$/;
const DISCORD_ID = /^\d{17,20}$/;
const CARD_ID = /^[a-z0-9_-]{1,100}$/i;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export type ProfileAppearance = ReturnType<typeof readProfileAppearance>;
export type DiscordAppearance = ReturnType<typeof readDiscordAppearance>;

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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function matching(value: unknown, pattern: RegExp): string {
  return typeof value === "string" && pattern.test(value) ? value : "";
}

export function readProfileAppearance(value: unknown) {
  const data = record(value);
  return {
    cover: data.cover === "discord" || data.cover === "solid" ? data.cover : "chronicle" as const,
    coverColor: matching(data.coverColor, /^#[a-f0-9]{6}$/i) || DEFAULT_PROFILE_COLOR,
    showAvatarDecoration: data.showAvatarDecoration === true,
    showNameplate: data.showNameplate === true,
    showGuildTag: data.showGuildTag === true,
    featuredDeckId: matching(data.featuredDeckId, UUID).toLowerCase(),
    favoriteCardId: matching(data.favoriteCardId, CARD_ID),
    effect: data.effect === "chronicle" ? "chronicle" as const : "none" as const,
  };
}

export function readDiscordAppearance(value: unknown) {
  const data = record(value);
  return {
    id: matching(data.id, DISCORD_ID),
    avatar: matching(data.avatar, HASH),
    banner: matching(data.banner, HASH),
    accent: matching(data.accent, /^#[a-f0-9]{6}$/i),
    decoration: matching(data.decoration, HASH),
    nameplate: matching(data.nameplate, /^nameplates\/(?:[a-z0-9_-]{1,100}\/){1,4}$/i),
    nameplatePalette: matching(data.nameplatePalette, /^(crimson|berry|sky|teal|forest|bubble_gum|violet|cobalt|clover|lemon|white)$/),
    guildTag: text(data.guildTag).slice(0, 16),
    guildBadge: matching(data.guildBadge, HASH),
    guildId: matching(data.guildId, DISCORD_ID),
  };
}

export function readDiscordProfileResponse(value: unknown): DiscordAppearance {
  const data = record(value);
  const decoration = record(data.avatar_decoration_data);
  const nameplate = record(record(data.collectibles).nameplate);
  const guild = record(data.primary_guild);
  const accent = data.accent_color;
  return readDiscordAppearance({
    id: data.id, avatar: data.avatar, banner: data.banner,
    accent: typeof accent === "number" && Number.isInteger(accent) && accent >= 0 && accent <= 0xffffff
      ? `#${accent.toString(16).padStart(6, "0")}` : "",
    decoration: decoration.asset, nameplate: nameplate.asset, nameplatePalette: nameplate.palette,
    guildTag: guild.identity_enabled === true ? guild.tag : "",
    guildBadge: guild.identity_enabled === true ? guild.badge : "",
    guildId: guild.identity_enabled === true ? guild.identity_guild_id : "",
  });
}

function discordImage(path: string, hash: string, size: number, animated: boolean): string {
  return `${DISCORD_CDN}/${path}/${hash}.webp?size=${size}${animated && hash.startsWith("a_") ? "&animated=true" : ""}`;
}

export function discordAppearanceImages(discord: DiscordAppearance, animated = true) {
  return {
    avatar: discord.id && discord.avatar ? discordImage(`avatars/${discord.id}`, discord.avatar, 256, animated) : "",
    banner: discord.id && discord.banner ? discordImage(`banners/${discord.id}`, discord.banner, 1024, animated) : "",
    decoration: discord.decoration ? `${DISCORD_CDN}/avatar-decoration-presets/${discord.decoration}.png?size=160${animated ? "" : "&passthrough=false"}` : "",
    nameplate: discord.nameplate ? `${DISCORD_CDN}/assets/collectibles/${discord.nameplate}${animated ? "asset.webm" : "static.png"}` : "",
    guildBadge: discord.guildId && discord.guildBadge ? `${DISCORD_CDN}/guild-tag-badges/${discord.guildId}/${discord.guildBadge}.png?size=32` : "",
  };
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
    appearance: readProfileAppearance(profile?.appearance),
    discord: readDiscordAppearance(user.user_metadata?.discord_profile),
  };
}
