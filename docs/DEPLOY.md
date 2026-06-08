# Deploy Pathway Prep Exams

## 1. GitHub

```bash
cd pathway-prep-exams
git remote add origin https://github.com/YOUR_USER/pathway-prep-exams.git
git push -u origin main
```

## 2. Render

1. **New Web Service** → connect `pathway-prep-exams` repo (or use `render.yaml` Blueprint)
2. **Build command:** `npm install && npm run exam:build` (required — without this you get `Cannot GET /`)
3. **Instance type:** Free
3. **Environment variables** (copy from `.env.example`):

| Variable | Notes |
|----------|--------|
| `TURSO_DATABASE_URL` | Same as pathway-prep-portal |
| `TURSO_AUTH_TOKEN` | Same as pathway-prep-portal |
| `EXAM_ADMIN_KEY` | Admin login for `/admin/` |
| `EXAM_JWT_SECRET` | 32+ chars, different from admin key |
| `RESEND_API_KEY` | For OTP + certificates |
| `RESEND_FROM` | Verified sender |
| `EXAM_PUBLIC_URL` | `https://exams.pathwayprep.online` |

4. Deploy → verify `https://YOUR-SERVICE.onrender.com/health`

## 3. Custom domain (free tier — avoid “SERVICE WAKING UP”)

Render **free** services sleep after ~15 minutes idle and show a cold-start splash for 30–60s.
Use **Netlify for the UI** (free, always on) and keep **Render for the API only**:

1. **Netlify** → New site → connect `pathway-prep-exams` repo (uses root `netlify.toml`)
2. **Hostinger DNS:** CNAME `exams` → your Netlify site (e.g. `something.netlify.app`), **not** Render
3. **Render:** remove `exams.pathwayprep.online` custom domain if added; keep `pathway-prep-exams.onrender.com` for API proxy target
4. GitHub Action **Keep exams warm** pings `/health` every 5 minutes (already in repo)

Students load pages from Netlify instantly; the app shows “Starting exam portal…” while `/health` wakes Render.

**Optional (extra free backup):** [UptimeRobot](https://uptimerobot.com) monitor `https://pathway-prep-exams.onrender.com/health` every 5 minutes.

**Option A — subdomain (recommended):** `exams.pathwayprep.online` → Netlify (see above)

**Legacy (Render-only domain):** CNAME `exams` → Render — works but students see Render’s wake-up splash

**Option B — path on main site:** `pathwayprep.online/exams`

- Already configured in Pathway-prep `_redirects` (proxies to exams Render URL)
- Set `EXAM_PUBLIC_URL=https://pathwayprep.online` if using path proxy

## 4. Smoke test

1. Admin: `/admin/` → create exam → add questions → publish
2. Student: registered email in portal → OTP → dashboard → take exam
3. Pass above cutoff → certificate email received
