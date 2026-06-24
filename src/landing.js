export function landingPage(env) {
  const site   = env.SITE_NAME || "CDN";
  const prefix = env.ROUTE_PREFIX || "files";
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><title>${site}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui,-apple-system,sans-serif;max-width:760px;
       margin:40px auto;padding:0 20px;color:#222;line-height:1.55}
  h1{color:#f7931e}
  code,pre{background:#f4f4f4;padding:2px 6px;border-radius:4px;font-size:14px}
  pre{padding:14px;overflow:auto}
  .pill{display:inline-block;background:#e7f5ff;color:#1971c2;
        padding:2px 10px;border-radius:999px;font-size:12px;margin-left:6px}
  footer{margin-top:40px;color:#888;font-size:13px}
</style></head><body>
<h1>🟠 ${site} <span class="pill">online</span></h1>
<p>Caching proxy for your API. Files requested here are fetched from the origin
on cache miss, then served from the Cloudflare edge for everyone else.</p>

<h3>Routes</h3>
<pre><code>/${prefix}/&lt;id&gt;   → cached file response
/health         → JSON health check</code></pre>

<h3>Example</h3>
<pre><code>&lt;img src="${"${location.origin}"}/${prefix}/123"&gt;</code></pre>

<footer>
  Origin: <b>${env.API_URL || "(not set)"}</b>
  · Hotlink protection: <b>${String(env.ENABLE_HOTLINK_PROTECTION).toLowerCase() === "true" ? "ON" : "OFF"}</b>
  · Cache TTL: <b>${env.CACHE_TTL_DAYS || 30} days</b>
  · © ${new Date().getFullYear()} ${site}
</footer>
</body></html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
