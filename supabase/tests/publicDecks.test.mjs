// Run with PUBLIC_DECKS_TEST_RUNTIME pointing to a temporary npm prefix containing
// @electric-sql/pglite. This executes the real migrations in an isolated Postgres.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const runtime = process.env.PUBLIC_DECKS_TEST_RUNTIME;
if (!runtime) throw new Error("Set PUBLIC_DECKS_TEST_RUNTIME to the npm prefix containing @electric-sql/pglite.");
const { PGlite } = await import(pathToFileURL(join(runtime, "node_modules/@electric-sql/pglite/dist/index.js")).href);

test("public deck and author lifecycle enforces ownership and privacy in Postgres", async () => {
  const db = new PGlite();
  const author = "10000000-0000-4000-8000-000000000001";
  const reader = "20000000-0000-4000-8000-000000000002";
  const deckId = "30000000-0000-4000-8000-000000000003";
  const copiedId = "40000000-0000-4000-8000-000000000004";
  const background = `${author}/${deckId}/cover.webp`;
  const asRole = (role, id, sql, params = []) => db.transaction(async tx => {
    assert.ok(["anon", "authenticated"].includes(role));
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id ?? ""]);
    return (await tx.query(sql, params)).rows;
  });
  try {
    // Minimal Supabase-owned schemas; application tables and policies come from migrations.
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create schema storage;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table storage.buckets(id text primary key, name text, public boolean,
        file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant usage on schema auth, storage, public to anon, authenticated;
      grant select on storage.objects to anon, authenticated;
    `);
    await db.query("insert into auth.users values ($1, 'secret@example.com', $2), ($3, 'reader@example.com', '{}')", [
      author, JSON.stringify({ full_name: "Deck author", player_profile: { bio: "My strategy", favoriteChronicle: "blue" } }), reader,
    ]);
    for (const migration of ["202611170001_decks.sql", "202611170002_public_profiles.sql", "202611170003_deck_discussions.sql"]) {
      await db.exec(await readFile(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
    }
    const ownProfile = await asRole("authenticated", author, "select * from public.player_profiles");
    assert.equal(ownProfile.length, 1);
    assert.equal(ownProfile[0].name, "Deck author");
    assert.equal(ownProfile[0].bio, "My strategy");
    assert.ok(!("email" in ownProfile[0]));
    assert.equal((await asRole("anon", null, "select * from public.player_profiles")).length, 0);
    await asRole("authenticated", author, `insert into public.decks(id, owner_id, name, faction, background_image_path, description)
      values ($1, $2, 'Strategy', 'blue', $3, 'Private strategy notes')`, [deckId, author, background]);
    assert.equal((await asRole("authenticated", author, "select description from public.decks where id = $1", [deckId]))[0].description, "Private strategy notes");
    await assert.rejects(asRole("authenticated", author, "update public.decks set description = $1 where id = $2", ["x".repeat(5001), deckId]), /check constraint/);
    await db.query("insert into storage.objects values ('deck-backgrounds', $1)", [background]);
    assert.equal((await asRole("anon", null, "select * from public.decks")).length, 0);
    assert.equal((await asRole("authenticated", reader, "select * from public.decks")).length, 0);
    assert.equal((await asRole("anon", null, "select * from storage.objects")).length, 0);
    await assert.rejects(asRole("authenticated", reader,
      "insert into public.decks(owner_id, name, faction) values ($1, 'Forged', 'blue')", [author]), /row-level security/);
    const published = await asRole("authenticated", author,
      "update public.decks set visibility = 'public', description = 'Public strategy notes' where id = $1 and revision = 1 returning *", [deckId]);
    assert.equal(published[0].revision, 2);
    assert.ok(published[0].published_at);
    assert.equal(published[0].description, "Public strategy notes");
    assert.equal((await asRole("anon", null, "select * from public.decks")).length, 1);
    assert.equal((await asRole("anon", null, "select * from public.player_profiles")).length, 1);
    assert.equal((await asRole("anon", null, "select * from storage.objects")).length, 1);
    assert.equal((await asRole("authenticated", reader,
      "update public.decks set name = 'Hijacked' where id = $1 returning id", [deckId])).length, 0);
    assert.equal((await asRole("authenticated", reader,
      "delete from public.decks where id = $1 returning id", [deckId])).length, 0);
    await assert.rejects(asRole("authenticated", author,
      "update public.player_profiles set name = 'Direct edit' where id = $1", [author]), /permission denied/);
    await assert.rejects(asRole("anon", null, "select email from auth.users"), /permission denied/);
    await db.query(`update auth.users set raw_user_meta_data =
      jsonb_set(raw_user_meta_data, '{player_profile,bio}', '"Updated bio"') where id = $1`, [author]);
    assert.equal((await asRole("anon", null, "select bio from public.player_profiles"))[0].bio, "Updated bio");
    const commentId = "50000000-0000-4000-8000-000000000005";
    const replyId = "60000000-0000-4000-8000-000000000006";
    const nestedId = "70000000-0000-4000-8000-000000000007";
    const insertComment = "insert into public.deck_comments(id, deck_id, author_id, parent_id, body) values ($1, $2, $3, $4, $5) returning *";
    await asRole("authenticated", author, insertComment, [commentId, deckId, author, null, "Creator's advice"]);
    await asRole("authenticated", reader, insertComment, [replyId, deckId, reader, commentId, "A player's question"]);
    await asRole("authenticated", author, insertComment, [nestedId, deckId, author, replyId, "Reply to the player"]);
    const discussion = await asRole("anon", null, "select * from public.deck_comments order by created_at, id");
    assert.equal(discussion.length, 3);
    assert.equal(discussion[1].parent_id, commentId);
    assert.equal(discussion[2].parent_id, replyId);
    assert.ok(discussion[2].created_at >= discussion[1].created_at);
    // A commenter without published decks is now a readable public participant.
    assert.equal((await asRole("anon", null, "select * from public.player_profiles where id = $1", [reader])).length, 1);
    await assert.rejects(asRole("anon", null,
      "insert into public.deck_comments(deck_id, author_id, body) values ($1, $2, 'Anonymous')", [deckId, reader]), /permission denied/);
    await assert.rejects(asRole("authenticated", reader,
      "insert into public.deck_comments(deck_id, author_id, body) values ($1, $2, 'Forged identity')", [deckId, author]), /row-level security/);
    for (const body of [" \n\t ", "x".repeat(2001)]) {
      await assert.rejects(asRole("authenticated", reader,
        "insert into public.deck_comments(deck_id, author_id, body) values ($1, $2, $3)", [deckId, reader, body]), /check constraint/);
    }
    await assert.rejects(asRole("authenticated", reader,
      "insert into public.deck_comments(deck_id, author_id, body, created_at) values ($1, $2, 'Forged date', now())", [deckId, reader]), /permission denied/);
    await assert.rejects(asRole("authenticated", reader, insertComment, [replyId, deckId, reader, commentId, "A player's question"]), /duplicate key/);
    await db.exec(await readFile(new URL("../migrations/202611200001_manage_deck_comments.sql", import.meta.url), "utf8"));
    const editComment = "update public.deck_comments set body = $2 where id = $1 returning *";
    const deleteComment = "delete from public.deck_comments where id = $1 returning id";
    await assert.rejects(asRole("anon", null, editComment, [commentId, "Anonymous edit"]), /permission denied/);
    await assert.rejects(asRole("anon", null, deleteComment, [commentId]), /permission denied/);
    assert.equal((await asRole("authenticated", reader, editComment, [commentId, "Another player's edit"])).length, 0);
    assert.equal((await asRole("authenticated", reader, deleteComment, [commentId])).length, 0);
    assert.equal((await asRole("authenticated", author, deleteComment, [replyId])).length, 0);
    await assert.rejects(asRole("authenticated", reader,
      "update public.deck_comments set parent_id = null where id = $1", [replyId]), /permission denied/);
    for (const body of [" \n\t ", "x".repeat(2001)]) {
      await assert.rejects(asRole("authenticated", reader, editComment, [replyId, body]), /check constraint/);
    }
    const [edited] = await asRole("authenticated", reader, editComment, [replyId, "Updated question"]);
    assert.deepEqual(edited, { ...discussion[1], body: "Updated question" });
    assert.equal((await asRole("anon", null, "select body from public.deck_comments where id = $1", [replyId]))[0].body, "Updated question");
    // An imported deck receives new ownership and the database's private default.
    await asRole("authenticated", reader, `insert into public.decks(id, owner_id, name, faction, content)
      select $1, $2, name, faction, content from public.decks where id = $3 and visibility = 'public'`, [copiedId, reader, deckId]);
    assert.equal((await asRole("authenticated", reader, "select visibility from public.decks where id = $1", [copiedId]))[0].visibility, "private");
    await assert.rejects(asRole("authenticated", reader,
      "insert into public.deck_comments(deck_id, author_id, body) values ($1, $2, 'Private deck comment')", [copiedId, reader]), /row-level security/);
    // Public replies cannot link into another deck, even for the same player.
    await asRole("authenticated", reader, "update public.decks set visibility = 'public' where id = $1", [copiedId]);
    await assert.rejects(asRole("authenticated", reader,
      "insert into public.deck_comments(deck_id, author_id, parent_id, body) values ($1, $2, $3, 'Wrong deck')", [copiedId, reader, commentId]), /Reply target/);
    await asRole("authenticated", reader, "update public.decks set visibility = 'private' where id = $1", [copiedId]);
    assert.equal((await asRole("authenticated", author,
      "update public.decks set visibility = 'private' where id = $1 and revision = 1 returning id", [deckId])).length, 0);
    const withdrawn = await asRole("authenticated", author,
      "update public.decks set visibility = 'private' where id = $1 and revision = 2 returning *", [deckId]);
    assert.equal(withdrawn[0].published_at, null);
    assert.equal(withdrawn[0].revision, 3);
    assert.equal((await asRole("anon", null, "select * from public.decks")).length, 0);
    assert.equal((await asRole("anon", null, "select * from public.player_profiles")).length, 0);
    assert.equal((await asRole("anon", null, "select * from storage.objects")).length, 0);
    assert.equal((await asRole("anon", null, "select * from public.deck_comments")).length, 0);
    await assert.rejects(asRole("authenticated", author,
      "insert into public.deck_comments(deck_id, author_id, body) values ($1, $2, 'Withdrawn deck comment')", [deckId, author]), /row-level security/);
    assert.equal((await asRole("authenticated", author, editComment, [commentId, "Edit on a withdrawn deck"])).length, 0);
    assert.equal((await asRole("authenticated", author, deleteComment, [commentId])).length, 0);
    assert.equal((await db.query("select * from public.deck_comments")).rows.length, 3);
    await asRole("authenticated", author, "update public.decks set visibility = 'public' where id = $1", [deckId]);
    assert.equal((await asRole("anon", null, "select * from public.deck_comments")).length, 3);
    assert.deepEqual(await asRole("authenticated", author, deleteComment, [commentId]), [{ id: commentId }]);
    const remaining = await asRole("anon", null, "select * from public.deck_comments order by created_at, id");
    assert.deepEqual(remaining, [{ ...edited, parent_id: null }, discussion[2]]);
    await asRole("authenticated", author, "update public.decks set visibility = 'private' where id = $1", [deckId]);
    assert.equal((await asRole("authenticated", reader, "select * from public.decks where id = $1", [copiedId])).length, 1);
    await db.query("delete from auth.users where id = $1", [author]);
    assert.equal((await db.query("select * from public.player_profiles where id = $1", [author])).rows.length, 0);
    assert.equal((await db.query("select * from public.deck_comments where deck_id = $1", [deckId])).rows.length, 0);
    assert.equal((await asRole("authenticated", reader, "select * from public.decks where id = $1", [copiedId])).length, 1);
    await db.query("insert into auth.users values ($1, 'new@example.com', '{}')", [author]);
    assert.equal((await asRole("authenticated", author, "select name from public.player_profiles"))[0].name, "Discord user");
  } finally {
    await db.close();
  }
});
