/**
 *  File handler — works for any file type (PDF, DOCX, video, etc.).
 *
 *  Uses drive.google.com/uc?export=download&id=...
 *  - For files < 100 MB, no virus-scan interstitial is triggered.
 *  - Range requests are passed through so HTML5 video can seek.
 *  - Set ?dl=1 to force a download with Content-Disposition: attachment.
 */

export async function handleFile(request, ctx, env, gdriveId, filename, forceDownload) {
  const cacheUrl = new URL(request.url);
  // Strip ?dl=1 from cache key — same bytes, different header
  cacheUrl.searchParams.delete("dl");
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cache    = caches.default;

  const rangeHeader = request.headers.get("Range");
  // Don't cache Range responses — they're partial
  if (!rangeHeader) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const hit = applyDisposition(new Response(cached.body, cached), filename, forceDownload);
      hit.headers.set("X-Cache", "HIT");
      return hit;
    }
  }

  const upstreamUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(gdriveId)}`;
  const ttlSeconds  = (Number(env.CACHE_TTL_DAYS) || 30) * 86400;

  const upstreamHeaders = {
    "User-Agent": `Mozilla/5.0 (${env.SITE_NAME || "gdrive-cf-proxy"})`,
  };
  if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

  const upstream = await fetch(upstreamUrl, {
    redirect: "follow",
    cf: rangeHeader
      ? { cacheTtl: 0 } // Don't cache partial responses on CF side
      : { cacheTtl: ttlSeconds, cacheEverything: true },
    headers: upstreamHeaders,
  });

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(
      `File not available (status ${upstream.status}). ` +
        `Make sure the file is shared correctly and under 100 MB.`,
      { status: upstream.status }
    );
  }

  let res = new Response(upstream.body, upstream);

  // Preserve Content-Length and Content-Range for video
  // Strip privacy-leaking headers
  res.headers.delete("Set-Cookie");

  // Cache control
  if (!rangeHeader) {
    res.headers.set("Cache-Control", `public, max-age=${ttlSeconds}, immutable`);
  } else {
    res.headers.set("Cache-Control", "no-store");
  }
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Accept-Ranges", "bytes");
  res.headers.set("X-Cache", "MISS");
  res.headers.set("X-Served-By", env.SITE_NAME || "gdrive-cf-proxy");

  res = applyDisposition(res, filename, forceDownload);

  if (!rangeHeader && upstream.ok) {
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  return res;
}

function applyDisposition(res, filename, forceDownload) {
  const disposition = forceDownload ? "attachment" : "inline";
  const safeName = filename ? sanitizeFilename(filename) : null;
  const value = safeName
    ? `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`
    : disposition;
  res.headers.set("Content-Disposition", value);
  return res;
}

function sanitizeFilename(name) {
  return name.replace(/[\r\n"]/g, "").slice(0, 200);
}
