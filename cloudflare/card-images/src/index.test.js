import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index.js";

const cardUrl = "https://cards.example.workers.dev/cards/blue/aor_03_001_ex-full.webp";

function environment(calls) {
  const object = {
    body: "card image",
    size: 10,
    httpEtag: '"card-1"',
    writeHttpMetadata(headers) { headers.set("Content-Type", "image/webp"); },
  };
  return {
    CARD_IMAGES: {
      async get(key) { calls.push(["get", key]); return object; },
      async head(key) { calls.push(["head", key]); return object; },
    },
  };
}

test("serves an uploaded card with cache headers", async () => {
  const calls = [];
  const response = await worker.fetch(new Request(cardUrl), environment(calls));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/webp");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=86400");
  assert.equal(response.headers.get("ETag"), '"card-1"');
  assert.equal(await response.text(), "card image");
  assert.deepEqual(calls, [["get", "cards/blue/aor_03_001_ex-full.webp"]]);
});

test("does not read the bucket for other paths or methods", async () => {
  const calls = [];
  const env = environment(calls);
  assert.equal((await worker.fetch(new Request("https://cards.example.workers.dev/private.txt"), env)).status, 404);
  assert.equal((await worker.fetch(new Request(cardUrl, { method: "POST" }), env)).status, 405);
  assert.deepEqual(calls, []);
});

test("HEAD returns metadata without downloading the image", async () => {
  const calls = [];
  const response = await worker.fetch(new Request(cardUrl, { method: "HEAD" }), environment(calls));
  assert.equal(response.status, 200);
  assert.equal(response.body, null);
  assert.deepEqual(calls, [["head", "cards/blue/aor_03_001_ex-full.webp"]]);
});
