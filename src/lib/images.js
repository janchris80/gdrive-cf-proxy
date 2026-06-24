/**
 *  Image handler — uses Google's image CDN (lh3.googleusercontent.com).
 *  Supports size params:  w1200, w1920, s0 (original), w800-h600-c, etc.
 */

export async function handleImage(request, ctx, env, gdriveId, size) {
  if (!/^[A-Za-z0-9=_\-]{1,40}$/.test(size)) {
    return new Response("Invalid size param.", { status: 400 });
  }
  if (size === "original") size = "s0";

  const cacheUrl = new URL(request.url);
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cache    = caches.default;

  let cached = await cache.match(cacheKey);
  if (cached) {
    const hit = new Response(cached.body, cached);
    hit.headers.set("X-Cache", "HIT");
    return hit;
  }

  const upstreamUrl = `https://lh3.googleusercontent.com/d/${gdriveId}=${size}`;
  const ttlSeconds = (Number(env.CACHE_TTL_DAYS) || 30) * 86400;

  const upstream = await fetch(upstreamUrl, {
    cf: { cacheTtl: ttlSeconds, cacheEverything: true },
    headers: {
      "User-Agent": `Mozilla/5.0 (${env.SITE_NAME || "gdrive-cf-proxy"})`,
      Accept: "image/*,*/*;q=0.8",
    },
  });

  if (!upstream.ok) {
    return new Response(
      `Image not found (status ${upstream.status}). ` +
        `Make sure the file is shared correctly.`,
      { status: upstream.status }
    );
  }

  const res = new Response(upstream.body, upstream);
  res.headers.set("Cache-Control", `public, max-age=${ttlSeconds}, immutable`);
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("X-Cache", "MISS");
  res.headers.set("X-Served-By", env.SITE_NAME || "gdrive-cf-proxy");
  res.headers.delete("Set-Cookie");

  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
