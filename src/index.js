/**
 *  CDN Worker — simple caching proxy.
 *
 *  Routes:
 *    /                  → landing page
 *    /health            → JSON health check
 *    /{ROUTE_PREFIX}/*  → proxied to API_URL/{ROUTE_PREFIX}/*
 *
 *  Everything else returns 404.
 */

import { landingPage } from "./landing.js";
import { proxyRequest } from "./lib/proxy.js";
import { checkHotlink } from "./lib/hotlink.js";

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const prefix = (env.ROUTE_PREFIX || "files").replace(/^\/|\/$/g, "");

    // ----- Static routes -----
    if (url.pathname === "/" || url.pathname === "") {
      return landingPage(env);
    }
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          ok:    true,
          name:  env.SITE_NAME || "CDN",
          time:  new Date().toISOString(),
        }, null, 2),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    if (url.pathname === "/favicon.ico") {
      return new Response(null, { status: 204 });
    }

    // ----- File proxy -----
    if (url.pathname.startsWith("/" + prefix + "/")) {
      // Optional hotlink protection (cheap, do first)
      if (String(env.ENABLE_HOTLINK_PROTECTION).toLowerCase() === "true") {
        const blocked = checkHotlink(request, env);
        if (blocked) return blocked;
      }

      // Misconfiguration check
      if (!env.API_URL) {
        return new Response("Worker misconfigured: API_URL missing.", { status: 500 });
      }
      if (!env.INTERNAL_TOKEN) {
        return new Response("Worker misconfigured: INTERNAL_TOKEN missing.", { status: 500 });
      }

      return proxyRequest(request, ctx, env);
    }

    return new Response("Not found", { status: 404 });
  },
};
