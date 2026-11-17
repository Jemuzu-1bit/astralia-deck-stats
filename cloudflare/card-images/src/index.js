const cardPath = /^\/cards\/[a-z0-9-]+\/[a-z0-9_-]+-(?:thumb|full)\.webp$/;

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    const pathname = new URL(request.url).pathname;
    if (!cardPath.test(pathname)) return new Response("Not Found", { status: 404 });

    const key = pathname.slice(1);
    const object = request.method === "HEAD"
      ? await env.CARD_IMAGES.head(key)
      : await env.CARD_IMAGES.get(key);
    if (!object) return new Response("Not Found", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", "image/webp");
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("ETag", object.httpEtag);
    headers.set("Content-Length", String(object.size));
    headers.set("Access-Control-Allow-Origin", "*");

    return new Response(request.method === "HEAD" ? null : object.body, {
      status: 200,
      headers,
    });
  },
};
