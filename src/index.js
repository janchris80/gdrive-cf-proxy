/**
 * =========================================================
 *  GDrive Image Proxy — Cloudflare Worker
 *  Made for LGU Kapalong (free tier friendly)
 *
 *  What this does:
 *   - Takes /FILE_ID or /FILE_ID/SIZE in the URL
 *   - Fetches the image from Google Drive's CDN
 *   - Caches it at the Cloudflare edge for X days
 *   - All future hits are served from cache (GDrive is NOT called)
 *
 *  Notes for LGU Kapalong:
 *   - GDrive is used for IMAGES ONLY (no video).
 *   - All uploads are < 100 MB so no virus-scan interstitial.
 *   - Files must be shared "Anyone with the link".
 * =========================================================
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // -------- Routes --------
    if (url.pathname === "/" || url.pathname === "") {
      return landingPage(env);
    }
    if (url.pathname === "/health") {
      return json({ ok: true, service: "gdrive-cf-proxy", time: new Date().toISOString() });
    }
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // -------- Parse path: /FILE_ID  OR  /FILE_ID/SIZE --------
    const parts = url.pathname.split("/").filter(Boolean);
    const fileId = parts[0];
    const sizeRaw = parts[1] || env.DEFAULT_SIZE || "w1600";

    // Basic validation (GDrive IDs are 25+ chars of [A-Za-z0-9_-])
    if (!fileId || !/^[a-zA-Z0-9_-]{20,}$/.test(fileId)) {
      return new Response("Invalid Google Drive file ID.", { status: 400 });
    }
    if (!/^[a-zA-Z0-9=_\-]{1,40}$/.test(sizeRaw)) {
      return new Response("Invalid size parameter.", { status: 400 });
    }

    // Allow alias: "original" => "s0"
    const size = sizeRaw === "original" ? "s0" : sizeRaw;

    // -------- Hotlink protection --------
    if (String(env.ENABLE_HOTLINK_PROTECTION).toLowerCase() === "true") {
      const blocked = checkHotlink(request, env);
      if (blocked) return blocked;
    }

    // -------- Cache lookup --------
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cache = caches.default;
    let response = await cache.match(cacheKey);
    if (response) {
      // Already cached — return immediately
      const hit = new Response(response.body, response);
      hit.headers.set("X-Cache", "HIT");
      return hit;
    }

    // -------- Fetch from Google Drive CDN --------
    const gdriveUrl = `https://lh3.googleusercontent.com/d/${fileId}=${size}`;
    const cacheTtlSeconds = (Number(env.CACHE_TTL_DAYS) || 30) * 86400;

    let upstream;
    try {
      upstream = await fetch(gdriveUrl, {
        cf: {
          cacheTtl: cacheTtlSeconds,
          cacheEverything: true,
        },
        headers: {
          // A real-ish UA so Google doesn't throttle us
          "User-Agent":
            "Mozilla/5.0 (compatible; LGU-Kapalong-Proxy/1.0; +https://kapalong.gov.ph)",
          "Accept": "image/*,*/*;q=0.8",
        },
      });
    } catch (err) {
      return new Response("Upstream fetch failed: " + err.message, { status: 502 });
    }

    if (!upstream.ok) {
      return new Response(
        `Image not found or not public. (status ${upstream.status})\n` +
          `Make sure the file is shared as "Anyone with the link".`,
        { status: upstream.status }
      );
    }

    // -------- Build response with our own cache headers --------
    response = new Response(upstream.body, upstream);
    response.headers.set(
      "Cache-Control",
      `public, max-age=${cacheTtlSeconds}, immutable`
    );
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("X-Cache", "MISS");
    response.headers.set("X-Served-By", env.SITE_NAME || "gdrive-cf-proxy");
    response.headers.delete("Set-Cookie"); // required for edge caching

    // Store in cache for next time (non-blocking)
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};

/* ---------- Helpers ---------- */

function checkHotlink(request, env) {
  const allowed = (env.ALLOWED_REFERRERS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0 || allowed.includes("*")) return null;

  const referer = (request.headers.get("Referer") || "").toLowerCase();

  // Direct opens (no referer) are allowed — many browsers strip it.
  if (!referer) return null;

  try {
    const host = new URL(referer).hostname;
    const ok = allowed.some((d) => host === d || host.endsWith("." + d));
    if (ok) return null;
  } catch {
    /* fallthrough */
  }

  return new Response("Hotlinking not allowed for this domain.", { status: 403 });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function landingPage(env) {
  const site = env.SITE_NAME || "GDrive CF Proxy";
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${site}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;
         margin:40px auto;padding:0 20px;color:#222;line-height:1.55}
    h1{color:#f7931e}
    code,pre{background:#f4f4f4;padding:2px 6px;border-radius:4px;font-size:14px}
    pre{padding:14px;overflow:auto}
    .pill{display:inline-block;background:#e7f5ff;color:#1971c2;
          padding:2px 10px;border-radius:999px;font-size:12px;margin-left:6px}
    .ok{color:#2f9e44}
    footer{margin-top:40px;color:#888;font-size:13px}
  </style>
</head>
<body>
  <h1>🟠 ${site} <span class="pill">online</span></h1>
  <p>This Worker proxies and caches Google Drive images at the Cloudflare edge.</p>

  <h3>Usage</h3>
  <pre><code>/FILE_ID                  → default size (${env.DEFAULT_SIZE || "w1600"})
/FILE_ID/original         → original size
/FILE_ID/s0               → original size
/FILE_ID/w1200            → 1200px wide
/FILE_ID/w1920            → 1920px wide
/FILE_ID/w800-h600-c      → 800x600 cropped</code></pre>

  <h3>Example</h3>
  <pre><code>&lt;img src="${"${location.origin}"}/1tvA5RZ4yQ9sBuSQPdQNhEkkDTL_VkKX8/w1200"&gt;</code></pre>

  <h3>Endpoints</h3>
  <ul>
    <li><code>/health</code> — JSON health check</li>
    <li><code>/&lt;file_id&gt;</code> — image proxy</li>
  </ul>

  <footer>
    Hotlink protection: <b>${
      String(env.ENABLE_HOTLINK_PROTECTION).toLowerCase() === "true" ? "ON" : "OFF"
    }</b>
    · Cache TTL: <b>${env.CACHE_TTL_DAYS || 30} days</b>
    · Made with ❤️ for ${env.FOOTER_TEXT || "Image CDN"}
  </footer>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
