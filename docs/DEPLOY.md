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

## 3. Custom domain

**Option A — subdomain (recommended):** `exams.pathwayprep.online`

- Render → service → Settings → Custom Domains → add `exams.pathwayprep.online`
- Hostinger DNS: CNAME `exams` → your Render target

**Option B — path on main site:** `pathwayprep.online/exams`

- Already configured in Pathway-prep `_redirects` (proxies to exams Render URL)
- Set `EXAM_PUBLIC_URL=https://pathwayprep.online` if using path proxy

## 4. Smoke test

1. Admin: `/admin/` → create exam → add questions → publish
2. Student: registered email in portal → OTP → dashboard → take exam
3. Pass above cutoff → certificate email received
