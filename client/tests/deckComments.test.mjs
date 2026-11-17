import assert from "node:assert/strict";
import { test } from "node:test";
import { commentBody, commentThreads } from "../src/domain/deckComments.ts";

const comment = (id, parentId, createdAt) => ({ id, parentId, createdAt, deckId: "deck", authorId: "player", body: "Text", author: null });

test("threaded comments preserve replies, chronology and orphaned page entries", () => {
  const root = comment("root", null, "2026-11-17T10:00:00Z");
  const other = comment("other", null, "2026-11-17T11:00:00Z");
  const reply = comment("reply", "root", "2026-11-17T12:00:00Z");
  const nested = comment("nested", "reply", "2026-11-17T13:00:00Z");
  const orphan = comment("orphan", "not-loaded", "2026-11-17T14:00:00Z");
  assert.deepEqual(commentThreads([nested, other, reply, root, orphan, root]).map(({ comment, depth }) => [comment.id, depth]), [
    ["root", 0], ["reply", 1], ["nested", 2], ["other", 0], ["orphan", 0],
  ]);
});

test("comments reject empty or oversized text and preserve multiline plain text", () => {
  for (const text of ["", " \n\t ", "x".repeat(2001)]) assert.throws(() => commentBody(text));
  assert.equal(commentBody("  First line\nSecond line  "), "First line\nSecond line");
  assert.equal(commentBody("<b>Plain text</b>"), "<b>Plain text</b>");
});
