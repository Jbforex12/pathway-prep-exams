# Pathway Prep Exams (CBT)

Computer-based testing for Pathway Prep learners. Separate service from the partner portal and Telegram bot.

## Features

- Student login: email + one-time code (must exist in partner portal `candidates` table)
- CBT UI with timer, question navigation, auto-submit
- Per-student question randomization and shuffled answer options
- Admin: create exams, manual questions, Excel/PDF import, publish, view attempts
- Auto scoring and email certificate on pass (above cutoff %)

## Local setup

1. Copy `.env.example` to `.env`
2. Set **same** `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as `pathway-prep-portal`
3. Set `RESEND_API_KEY`, `EXAM_ADMIN_KEY`, `EXAM_JWT_SECRET`
4. `npm install && npm run dev`
5. Open `http://localhost:4010` (students) and `http://localhost:4010/admin/` (admin)

## Deploy (Render)

1. Push to GitHub and create Web Service from `render.yaml`
2. Set environment variables from `.env.example`
3. Point `exams.pathwayprep.online` CNAME to Render (or use Netlify proxy on `pathwayprep.online/exams`)

## Question import

- **Excel:** download template at `/assets/question-import-template.xlsx`
- **PDF:** use numbered questions with `A) B) C) D)` lines and `Answer: B` per question
