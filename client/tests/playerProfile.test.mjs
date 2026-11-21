import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDiscordCosmetics, availableDiscordCosmetics, discordAppearanceImages, getPlayerProfile, profileWebsite, readDiscordProfileResponse, readProfileAppearance } from "../src/domain/playerProfile.ts";

test("Discord identity and editable profile fields stay separate", () => {
  const profile = getPlayerProfile({
    email: "private@example.com",
    user_metadata: { full_name: "Old name", player_profile: { bio: "Control player", favoriteChronicle: "blue", website: "https://example.com/player" } },
    identities: [{ provider: "discord", identity_data: { full_name: "Discord name", avatar_url: "https://cdn.discordapp.com/avatar.png" } }],
  });
  assert.equal(profile.name, "Discord name");
  assert.equal(profile.avatar, "https://cdn.discordapp.com/avatar.png");
  assert.equal(profile.bio, "Control player");
  assert.equal(profile.favoriteChronicle, "blue");
  assert.equal(profile.website, "https://example.com/player");
  assert.ok(!JSON.stringify(profile).includes("private@example.com"));
});

test("missing Discord details never fall back to the private email", () => {
  const profile = getPlayerProfile({ email: "private@example.com", user_metadata: {} });
  assert.equal(profile.name, "Discord user");
  assert.equal(profile.avatar, "");
  assert.equal(profile.bio, "");
});

test("profile links reject executable schemes and embedded credentials", () => {
  assert.equal(profileWebsite("  https://example.com/me  "), "https://example.com/me");
  assert.equal(profileWebsite(""), "");
  for (const url of ["javascript:alert(1)", "data:text/html,hello", "https://user:password@example.com", "invalid", "//example.com"]) {
    assert.throws(() => profileWebsite(url), /valid website/);
    assert.equal(getPlayerProfile({ user_metadata: { player_profile: { website: url } } }).website, "");
  }
});

test("legacy profiles keep their chronicle cover and start with Discord cosmetics hidden", () => {
  const profile = getPlayerProfile({ user_metadata: { player_profile: { favoriteChronicle: "blue" } } });
  assert.equal(profile.favoriteChronicle, "blue");
  assert.deepEqual(profile.appearance, {
    cover: "chronicle", coverColor: "#383027", showAvatarDecoration: false, showNameplate: false,
    showGuildTag: false, featuredDeckId: "", favoriteCardId: "", effect: "none",
  });
  assert.deepEqual(readProfileAppearance({ cover: "solid", effect: "chronicle", coverColor: "url(https://example.test)", showGuildTag: "true" }), {
    ...profile.appearance, cover: "solid", effect: "chronicle",
  });
});

test("Discord assets use the linked account, keep black accents and honor disabled guild tags", () => {
  const id = "80351110224678912";
  const image = `a_${"a".repeat(32)}`;
  const profile = readDiscordProfileResponse({
    id, avatar: image, banner: image, accent_color: 0, avatar_decoration_data: { asset: image },
    collectibles: { nameplate: { asset: "nameplates/nameplates/twilight/", palette: "cobalt" } },
    primary_guild: { identity_enabled: false, tag: "HIDE", badge: image }, email: "ignored@example.test",
  });
  assert.equal(profile.accent, "#000000");
  assert.equal(profile.guildTag, "");
  assert.equal(profile.guildBadge, "");
  assert.ok(!("email" in profile));
  assert.equal(discordAppearanceImages(profile).banner, `https://cdn.discordapp.com/banners/${id}/${image}.webp?size=1024&animated=true`);
  assert.equal(discordAppearanceImages(profile, false).avatar, `https://cdn.discordapp.com/avatars/${id}/${image}.webp?size=256`);
  assert.match(discordAppearanceImages(profile).nameplate, /\/twilight\/asset\.webm$/);
  assert.match(discordAppearanceImages(profile, false).nameplate, /\/twilight\/static\.png$/);
  assert.equal(readDiscordProfileResponse({ banner: "../outside", collectibles: { nameplate: { asset: "nameplates/../outside/" } } }).nameplate, "");
});

test("applying a Discord look enables available cosmetics and preserves Astralia choices", () => {
  const appearance = readProfileAppearance({ cover: "solid", coverColor: "#123456", effect: "chronicle", favoriteCardId: "card-123" });
  const discord = readDiscordProfileResponse({ id: "80351110224678912", accent_color: 0, primary_guild: { identity_enabled: true, tag: "AST" } });
  assert.deepEqual(availableDiscordCosmetics(discord), { cover: "accent color", avatarDecoration: false, nameplate: false, guildTag: true });
  assert.deepEqual(applyDiscordCosmetics(appearance, discord), { ...appearance, cover: "discord", showGuildTag: true });
  assert.deepEqual(applyDiscordCosmetics(appearance, readDiscordProfileResponse({})), appearance);
});
