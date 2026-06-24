/**
 *  Proxy logic — fetch from API_URL, cache at the edge, pass Range through.
 */

export async function proxyRequest(request, ctx, env) {
  const url = new URL(request.url);

  const cache       = caches.default;
  const cacheKey    = new Request(url.toString(), { method: "GET" });
  const rangeHeader = request.headers.get("Range");

  // Range requests must NOT be served from cache (they're partial)
  if (!rangeHeader) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const hit = new Response(cached.body, cached);
      hit.headers.set("X-Cache", "HIT");
      return hit;
    }
  }

  // Build origin URL
  const apiBase   = env.API_URL.replace(/\/$/, "");
  const originUrl = apiBase + url.pathname + url.search;

  // Build origin headers (don't leak browser cookies/auth to origin)
  const originHeaders = {
    "X-Internal-Token": env.INTERNAL_TOKEN,
    "User-Agent": `${env.SITE_NAME || "cdn-worker"} (Cloudflare Worker)`,
  };
  if (rangeHeader) originHeaders["Range"] = rangeHeader;

  const ttlSeconds = (Number(env.CACHE_TTL_DAYS) || 30) * 86400;

  let upstream;
  try {
    upstream = await fetch(originUrl, {
      method:   "GET",
      headers:  originHeaders,
      redirect: "follow",
      cf: rangeHeader
        ? { cacheTtl: 0 }                                  // don't cache partial
        : { cacheTtl: ttlSeconds, cacheEverything: true }, // cache full
    });
  } catch (err) {
    return new Response("Upstream fetch failed: " + err.message, { status: 502 });
  }

  // 401/403 from origin = pass through unchanged
  if (!upstream.ok && upstream.status !== 206) {
    return new Response(upstream.body, {
      status:     upstream.status,
      statusText: upstream.statusText,
      headers:    stripCookies(upstream.headers),
    });
  }

  // Build user-facing response
  const res = new Response(upstream.body, upstream);
  res.headers.delete("Set-Cookie");
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Accept-Ranges", "bytes");
  res.headers.set("X-Cache", "MISS");
  res.headers.set("X-Served-By", env.SITE_NAME || "cdn-worker");

  if (!rangeHeader) {
    res.headers.set("Cache-Control", `public, max-age=${ttlSeconds}, immutable`);
    if (upstream.ok) {
      ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }
  } else {
    res.headers.set("Cache-Control", "no-store");
  }

  return res;
}

function stripCookies(headers) {
  const out = new Headers(headers);
  out.delete("Set-Cookie");
  return out;
}
