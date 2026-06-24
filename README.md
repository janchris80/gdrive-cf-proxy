# 🟠 GDrive CF Proxy v2 — File CDN

A free Cloudflare Worker that turns Google Drive into a full-blown CDN:

- 🖼️ **Images** (with on-the-fly resize)
- 📄 **PDFs / DOCX / any file**
- 🎬 **Videos < 100 MB** (with HTTP Range support for seeking)
- 🔐 **HMAC-signed fingerprint URLs** (hide real GDrive IDs)
- ⏰ **Expiring links** (revoke by rotating secret)
- 🛡️ **Hotlink protection**
- ⚡ **Edge cache** up to 365 days
- 🚀 **GitHub → auto-deploy** on push to `main`

> Paired with the Laravel package **[`kapalong/cdn-signer`](https://github.com/YOUR-ORG/laravel-cdn-signer)**.

---

## 🚀 Deploy

### Option A — GitHub auto-deploy (recommended)

1. Push this repo to GitHub
2. **Cloudflare → Workers & Pages → Create → Connect to Git**
3. Pick the repo → Save and Deploy
4. ✅ Every `git push` to `main` auto-redeploys

### Option B — GitHub Actions (already included)

Add these GitHub secrets:

| Secret | Where |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" |
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard sidebar |

### Option C — Local CLI

```bash
npm install
npx wrangler login
npm run deploy
```

---

## 🔑 Set the Signing Secret

This is the **only secret** you need. It must be **identical** to your Laravel `CDN_SECRET`:

```bash
npx wrangler secret put SIGNING_SECRET
# Paste the same value as your Laravel app's CDN_SECRET
```

Generate one if you don't have one yet:

```bash
php -r "echo bin2hex(random_bytes(32));"
```

---

## ⚙️ Environment Variables

All in `wrangler.toml`. Edit there or override in the Cloudflare dashboard.

| Var | Default | Description |
|---|---|---|
| `MODE` | `signed` | `signed` = only HMAC URLs work; `public` = raw IDs also work |
| `ALLOWED_REFERRERS` | `kapalong.gov.ph,...` | Comma-separated allow list |
| `ENABLE_HOTLINK_PROTECTION` | `false` | Set `true` to enforce the list |
| `DEFAULT_SIZE` | `w1600` | Default image size |
| `CACHE_TTL_DAYS` | `365` | Edge cache lifetime |
| `SIG_LENGTH` | `16` | HMAC hex chars (must match Laravel) |
| `SITE_NAME` | `LGU Kapalong CDN` | Branding |

Secret:

| Secret | How to set |
|---|---|
| `SIGNING_SECRET` | `wrangler secret put SIGNING_SECRET` |

---

## 📐 Routes

```
GET  /                       → landing page
GET  /health                 → JSON status

GET  /img/<token>            → image (default size)
GET  /img/<token>/w1200      → image with size
GET  /img/<token>/s0         → original size
GET  /img/<token>/w800-h600-c → cropped

GET  /file/<token>           → any file, inline
GET  /file/<token>/name.pdf  → with friendly filename
GET  /file/<token>?dl=1      → force download
```

`<token>` is:
- **public mode**: raw GDrive file ID (e.g., `1tvA5RZ4...`)
- **signed mode**: fingerprint from the Laravel package (`base64url.hmac16`)

---

## 🔗 Pairing with Laravel

Install the helper package in your Laravel app:

```bash
composer require kapalong/cdn-signer
```

Then in your API resources:

```php
use Kapalong\CdnSigner\Facades\Cdn;

return [
    "img_url"   => Cdn::fbPost($pubmat->gdrive_id),
    "thumb_url" => Cdn::thumb($pubmat->gdrive_id),
    "pdf_url"   => Cdn::file($doc->gdrive_id, $doc->filename),
    "dl_url"    => Cdn::download($doc->gdrive_id, $doc->filename),
];
```

Frontend gets clean URLs like:
```
https://cdn.kapalong.gov.ph/img/eyJpZCI6IjFTMzMi...HMAC
https://cdn.kapalong.gov.ph/file/eyJpZCI6IjFTMzMi...HMAC/report.pdf
```

---

## 🎬 About Videos

✅ **Works** for files under 100 MB.
⚠️ For 100 MB – 2 GB you'll hit Google's virus-scan interstitial.
❌ For >2 GB, please use a real video host (YouTube, Cloudflare Stream, etc.).

HTTP Range requests are passed through so HTML5 `<video>` seeking works:

```html
<video controls>
  <source src="https://cdn.kapalong.gov.ph/file/<token>/video.mp4" type="video/mp4">
</video>
```

---

## 🛠️ Local Development

```bash
cp .dev.vars.example .dev.vars
# fill in SIGNING_SECRET
npm install
npm run dev
```

Open <http://localhost:8787/>.

---

## 🧪 Quick Tests

```bash
# Health
curl https://YOUR-WORKER.workers.dev/health

# Public mode (set MODE=public first)
curl -I https://YOUR-WORKER.workers.dev/img/1abcDEF/w800

# Signed mode — get token from Laravel:
php artisan tinker
>>> Kapalong\CdnSigner\Facades\Cdn::thumb('1abcDEF...')
```

Check the response headers for `X-Cache: HIT` on second hit.

---

## 🩺 Troubleshooting

| Problem | Fix |
|---|---|
| `403 Invalid signature` | `SIGNING_SECRET` doesn't match Laravel `CDN_SECRET` |
| `410 Link expired` | Increase `CDN_TTL` in Laravel `.env` |
| `404 Not found` | File not shared "Anyone with the link" |
| Video doesn't seek | Make sure `Accept-Ranges: bytes` is in response (it is) |
| Image too small | Use `/img/<token>/w2400` or `/s0` |

---

## 📄 License

MIT © 2026 LGU Kapalong
