# 🟠 GDrive CF Proxy — LGU Kapalong

A free Cloudflare Worker that proxies and caches Google Drive images at the edge.
Designed for LGU Kapalong's pubmat / image hosting use case.

- ✅ 100% free tier (100,000 requests/day)
- ✅ No R2, no paid plan needed
- ✅ Bypasses Google Drive's "too many views" throttling
- ✅ Configurable via environment variables
- ✅ Hotlink protection (whitelist your own domains)
- ✅ Deployable from GitHub — push to main = auto-deploy

> Built specifically for **image files < 100 MB** (no videos), so the virus-scan
> interstitial never triggers.

---

## 🚀 Quick Deploy

### Option A — Deploy from GitHub (recommended)

1. **Fork or push this repo to GitHub.**
2. Go to **Cloudflare dashboard → Workers & Pages → Create → Workers → Connect to Git**.
3. Pick this repo. Cloudflare auto-detects `wrangler.toml`.
4. Click **Save and Deploy**.
5. Every `git push` to `main` will redeploy automatically. 🎉

### Option B — Deploy locally with Wrangler CLI

```bash
npm install
npx wrangler login
npm run deploy
```

### Option C — GitHub Actions (also included)

This repo ships with `.github/workflows/deploy.yml`.
Add these secrets in your GitHub repo settings:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard sidebar |

Then every push to `main` deploys automatically.

---

## ⚙️ Environment Variables

All env vars live in `wrangler.toml` under `[vars]`. You can also override
them in the **Cloudflare dashboard → Workers → Settings → Variables**.

| Variable | Default | Description |
|---|---|---|
| `ALLOWED_REFERRERS` | `kapalong.gov.ph,localhost,...` | Comma-separated domains allowed to hotlink. Use `*` for any. |
| `DEFAULT_SIZE` | `w1600` | Size if URL has no size param. Use `s0` for original. |
| `CACHE_TTL_DAYS` | `30` | How many days to cache images at the edge. |
| `ENABLE_HOTLINK_PROTECTION` | `false` | Set `true` to enforce the whitelist. |
| `SITE_NAME` | `LGU Kapalong Image CDN` | Shown on the landing page. |

### How to add/edit a variable in the dashboard

1. Workers & Pages → your worker → **Settings → Variables**
2. Under **Environment Variables**, click **Add variable**
3. Enter name + value, click **Save and deploy**

---

## 📐 URL Format

```
https://<your-worker>.workers.dev/<FILE_ID>[/<SIZE>]
```

| Path | Meaning |
|---|---|
| `/FILE_ID` | Default size (`w1600` unless changed) |
| `/FILE_ID/original` | Original size |
| `/FILE_ID/s0` | Original size (alias) |
| `/FILE_ID/w1200` | 1200px wide |
| `/FILE_ID/w1920` | 1920px wide |
| `/FILE_ID/s2000` | 2000px max (square fit) |
| `/FILE_ID/w800-h600-c` | 800×600 cropped |

### Where to find a GDrive `FILE_ID`

A typical share URL:
```
https://drive.google.com/file/d/1tvA5RZ4yQ9sBuSQPdQNhEkkDTL_VkKX8/view
                                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                this is your FILE_ID
```

> ⚠️ The file must be shared **"Anyone with the link"**, otherwise the
> Worker returns a 404.

---

## 💻 Local Development

```bash
cp .dev.vars.example .dev.vars
npm install
npm run dev
```

Then open <http://localhost:8787/>.

---

## 🧰 Use in Laravel

See [`examples/laravel-helper.php`](examples/laravel-helper.php) for a ready-to-paste helper.

```php
<img src="{{ \App\Helpers\ImageHelper::fbPost($pubmat->gdrive_id) }}" alt="...">
```

---

## 🩺 Troubleshooting

| Problem | Fix |
|---|---|
| `Image not found` | File isn't shared "Anyone with the link" |
| `Hotlinking not allowed` | Add the domain to `ALLOWED_REFERRERS` or set `ENABLE_HOTLINK_PROTECTION=false` |
| First load is slow, second is fast | Normal — first hit is cache MISS, then it's cached for `CACHE_TTL_DAYS` |
| `X-Cache: MISS` in headers | Hit the URL again — second time should say `HIT` |
| Want bigger image | Use `/FILE_ID/w2400` or `/FILE_ID/original` |

---

## 📄 License

MIT © 2026 LGU Kapalong
