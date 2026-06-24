/**
 *  Optional referrer whitelist.
 *  Set ENABLE_HOTLINK_PROTECTION = "true" to enforce.
 */

export function checkHotlink(request, env) {
  const allowed = (env.ALLOWED_REFERRERS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0 || allowed.includes("*")) return null;

  const referer = (request.headers.get("Referer") || "").toLowerCase();
  if (!referer) return null; // direct opens — allow

  try {
    const host = new URL(referer).hostname;
    const ok = allowed.some((d) => host === d || host.endsWith("." + d));
    if (ok) return null;
  } catch { /* fallthrough */ }

  return new Response("Hotlinking not allowed.", { status: 403 });
}
