# Keep Render awake (free tier)

Render **free** web services spin down after **15 minutes** without traffic. There is no official “never sleep” setting on the free plan — you keep them warm with **regular HTTP pings**.

Pathway Prep uses:

1. **GitHub Actions** — `.github/workflows/keep-alive.yml` pings every **4 minutes**
2. **Backup (recommended)** — [cron-job.org](https://cron-job.org) (free) as a second pinger

## Backup: cron-job.org (5 minutes to set up)

Create **two** cron jobs (one per Render service):

| Job | URL | Schedule |
|-----|-----|----------|
| Exams API | `https://pathway-prep-exams.onrender.com/health` | Every **10 minutes** |
| Partners API | `https://partners.pathwayprep.online/health` | Every **10 minutes** |

Use **GET**, timeout **120 seconds** (cold starts can take ~50s).

Ping the **`.onrender.com` URL** directly — not only the Netlify proxy — so traffic always reaches Render.

## Free tier limits

- **750 instance hours/month** per workspace on Render free
- Keeping 2 services awake 24/7 uses ~**1440 hours** — over the limit
- For **always-on 24/7**, upgrade each service to Render **Starter** (~$7/month each) or accept occasional sleep when pings fail

## What we fixed in code

- **`/health` responds before the database finishes loading** — faster cold starts
- **Exam UI no longer blocks on `/health`** — login page shows immediately (Netlify CDN)
- **Long-cache headers** for `/_next/static/*` on Netlify and Render
- **Faster deploys** — UI builds only in the build phase, not at server start

## Verify

```bash
curl -w "TTFB: %{time_starttransfer}s total: %{time_total}s\n" -o /dev/null -s https://pathway-prep-exams.onrender.com/health
```

Warm: **under 1 second**. Cold: **30–90 seconds** (first ping after sleep).
