# 🟠 janchris80/cdn

Cloudflare Worker caching proxy. Pairs with the Laravel package
**[`janchris80/cdn-storage`](https://github.com/janchris80/cdn-storage)**.

```
                Frontend                  Cloudflare Edge              Laravel API
  (any device)                          (this Worker)               (cdn-storage)
    │                                       │                            │
    ├── img src=cdn.domain.com/files/123 ──▶│                            │
    │                                       │  cache HIT  ⚡ return       │
    │                                       │                            │
    │                                       │  cache MISS                │
    │                                       ├────▶ X-Internal-Token  ───▶│
    │                                       │      Range (if any)         │
    │                                       │◀───────── file ────────────┤
    │                                       │  cache + serve              │
    │◀────────── file ──────────────────────┤                            │
```

- ⚡ **Edge cache** (up to 365 days)
- 🎬 **Range support** for video seeking
- 🛡️ **Hotlink protection** (optional)
- 🔐 **Origin lock-down** via `X-Internal-Token`
- 🚀 **GitHub → auto-deploy** on push to `main`
- 💸 **Free tier compatible** (100k requests/day)

---

## 🚀 Deploy

### Option A — GitHub auto-deploy (recommended)

1. Push this repo to GitHub.
2. **Cloudflare → Workers & Pages → Create → Connect to Git.**
3. Pick the repo → Save and Deploy.
4. ✅ Every `git push` to `main` redeploys.

### Option B — GitHub Actions (already included)

Add these GitHub repo secrets:

| Secret | Where |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard sidebar |

### Option C — Local CLI

```bash
npm install
npx wrangler login
npm run deploy
```

---

## 🔑 Set the Internal Token

This is the only secret. Must match Laravel's `CDN_INTERNAL_TOKEN`:

```bash
npx wrangler secret put INTERNAL_TOKEN
# paste the same value as your Laravel app's CDN_INTERNAL_TOKEN
```

Generate one if needed:

```bash
php -r "echo bin2hex(random_bytes(32));"
```

---

## ⚙️ Environment Variables

All in `wrangler.toml`. Override in the Cloudflare dashboard if you prefer.

| Var | Default | Description |
|---|---|---|
| `API_URL` | `https://api.example.com` | Origin Laravel app |
| `ROUTE_PREFIX` | `files` | Must match `cdn.route_prefix` in Laravel |
| `ALLOWED_REFERRERS` | `localhost,127.0.0.1` | Comma-separated allow list |
| `ENABLE_HOTLINK_PROTECTION` | `false` | `true` to enforce the list |
| `CACHE_TTL_DAYS` | `30` | Edge cache lifetime |
| `SITE_NAME` | `CDN` | Branding |

Secret:

| Secret | How to set |
|---|---|
| `INTERNAL_TOKEN` | `wrangler secret put INTERNAL_TOKEN` |

---

## 📐 Routes

```
GET  /                  → landing page
GET  /health            → JSON status
GET  /{prefix}/{id}     → cached file (proxies to API_URL/{prefix}/{id})
```

---

## 🔗 Pairing with Laravel

```bash
composer require janchris80/cdn-storage
```

`.env` on the Laravel side:

```env
CDN_URL=https://cdn.domain.com
CDN_INTERNAL_TOKEN=<same as worker INTERNAL_TOKEN>
CDN_ROUTE_PREFIX=files
```

In your API resource:

```php
use Janchris80\CdnStorage\Facades\Cdn;

return [
    "img_url" => Cdn::file($post->cover_file_id),
];
```

Result:

```json
{ "img_url": "https://cdn.domain.com/files/123" }
```

---

## 🎬 About videos

The Worker forwards `Range:` request headers so HTML5 `<video>` seeking works:

```html
<video controls>
  <source src="https://cdn.domain.com/files/45/video.mp4" type="video/mp4">
</video>
```

Range responses (HTTP 206) are not cached at the edge, but full GETs are.

---

## 🪺 Troubleshooting

| Problem | Fix |
|---|---|
| `403 Direct access not allowed` | `INTERNAL_TOKEN` doesn't match `CDN_INTERNAL_TOKEN` on Laravel |
| `502 Upstream fetch failed` | `API_URL` wrong, or Laravel not reachable from Cloudflare |
| `404 Not found` | Path doesn't start with `/{ROUTE_PREFIX}/` |
| `X-Cache: MISS` every time | Range request, or response had `Set-Cookie` (we strip it) |

Cache test:

```bash
curl -I https://YOUR-WORKER.workers.dev/files/123
# first hit:  X-Cache: MISS
# second hit: X-Cache: HIT
```

---

## 📄 License

MIT © 2026 janchris80
