/**
 *  GDrive File CDN — Cloudflare Worker v2
 *  Routes:
 *    /                    → landing page
 *    /health              → JSON health check
 *    /img/<token>         → image (default size)
 *    /img/<token>/<size>  → image with explicit size
 *    /file/<token>        → any file (inline view)
 *    /file/<token>/<name> → file with friendly filename
 *    /file/<token>?dl=1   → forced download
 *
 *  <token> is either a raw GDrive ID (public mode) or a
 *  signed fingerprint  base64url(payload).hmacShort  (signed mode).
 */

import { landingPage } from "./landing.js";
import { verifyToken } from "./lib/verify.js";
import { handleImage } from "./lib/images.js";
import { handleFile } from "./lib/files.js";
import { checkHotlink } from "./lib/hotlink.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ----- Static routes -----
    if (path === "/" || path === "") return landingPage(env);
    if (path === "/health")
      return json({ ok: true, mode: env.MODE || "signed", time: new Date().toISOString() });
    if (path === "/favicon.ico") return new Response(null, { status: 204 });

    // ----- Parse: /img/...  or /file/... -----
    const parts = path.split("/").filter(Boolean);
    if (parts.length < 2 || !["img", "file"].includes(parts[0])) {
      return new Response("Not found", { status: 404 });
    }

    const kind     = parts[0];                 // "img" | "file"
    const token    = parts[1];                 // raw id OR signed fingerprint
    const extra    = parts.slice(2).join("/"); // size for img, filename for file

    // ----- Hotlink protection (cheap, do it first) -----
    if (String(env.ENABLE_HOTLINK_PROTECTION).toLowerCase() === "true") {
      const blocked = checkHotlink(request, env);
      if (blocked) return blocked;
    }

    // ----- Resolve token → gdriveId + optional size -----
    const mode = (env.MODE || "signed").toLowerCase();
    let gdriveId, payloadSize = null;

    if (mode === "public") {
      // Raw ID in URL
      if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) {
        return new Response("Invalid file ID", { status: 400 });
      }
      gdriveId = token;
    } else {
      // Signed fingerprint
      const result = await verifyToken(token, kind, env);
      if (!result.ok) {
        return new Response(result.error, { status: result.status });
      }
      gdriveId    = result.payload.id;
      payloadSize = result.payload.sz || null;
    }

    // ----- Dispatch -----
    if (kind === "img") {
      const size = extra || payloadSize || env.DEFAULT_SIZE || "w1600";
      return handleImage(request, ctx, env, gdriveId, size);
    } else {
      const filename     = extra ? decodeURIComponent(extra) : null;
      const forceDownload = url.searchParams.get("dl") === "1";
      return handleFile(request, ctx, env, gdriveId, filename, forceDownload);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
