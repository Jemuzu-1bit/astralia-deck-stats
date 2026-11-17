import assert from "node:assert/strict";
import { test } from "node:test";
import { getPlayerProfile, profileWebsite } from "../src/domain/playerProfile.ts";

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
