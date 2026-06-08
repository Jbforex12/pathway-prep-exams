const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const { initDb, getDb, findCandidateByEmail } = require("./db");
const {
  resolveAdminKey,
  resolveJwtSecret,
  rateLimitMiddleware,
  secureCompare,
  hashOtp,
  generateOtp,
  newId,
  isProductionDeploy
} = require("./lib/security");
const {
  signAdminSession,
  verifyAdminSession,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  readAdminSessionToken
} = require("./lib/admin-session");
const {
  signStudentSession,
  verifyStudentSession,
  setStudentSessionCookie,
  clearStudentSessionCookie,
  readStudentSessionToken
} = require("./lib/exam-session");
const { sendOtpEmail, sendExamCertificateEmail, getEmailConfig } = require("./lib/email");
const { generateExamCertificatePdf } = require("./lib/exam-certificate");
const { ensureTemplateFile } = require("./lib/certificate-pdf");
const {
  getExamPreview,
  discardInProgressAttemptsForExam,
  startAttempt,
  saveAnswer,
  submitAttempt,
  getAttemptResult,
  getExamById,
  getCandidateExamStatus,
  listExhaustedCandidateExams,
  listQuestionsForExam,
  parseOptions,
  rescheduleCandidateExam,
  deliverPassCertificate,
  MAX_ATTEMPTS_PER_EXAM
} = require("./lib/exam-engine");
const { courseMatches } = require("./lib/course-match");
const { parseExcelBuffer } = require("./lib/import-excel");
const { parsePdfBuffer } = require("./lib/import-pdf");
const { importQuestionsForExam } = require("./lib/import-questions");
const { normalizeQuestionInput } = require("./lib/question-types");

function env(name) {
  let v = (process.env[name] || "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

const PORT = Number(process.env.PORT) || 4010;
const ADMIN_KEY = resolveAdminKey(env);
const JWT_SECRET = resolveJwtSecret(env, ADMIN_KEY);
const PUBLIC_URL = env("EXAM_PUBLIC_URL") || `http://localhost:${PORT}`;
const HOME_URL = env("PORTAL_HOME_URL") || "https://pathwayprep.online";

const COURSES = [
  "HEALTHCARE ASSISTANT",
  "PROFESSIONAL CLEANING & DOMESTIC SERVICE",
  "WAREHOUSING & LOGISTICS"
];

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (PUBLIC_URL.startsWith("https://") || isProductionDeploy()) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

const otpLimiter = rateLimitMiddleware("otp", 5, 900000);
const studentLimiter = rateLimitMiddleware("student", 120, 900000);
const adminLimiter = rateLimitMiddleware("admin", 60, 900000);

function authAdmin(req, res, next) {
  const apiKey = req.get("X-API-Key") || "";
  if (apiKey && secureCompare(apiKey, ADMIN_KEY)) return next();
  const token = readAdminSessionToken(req);
  if (verifyAdminSession(token, JWT_SECRET)) return next();
  return res.status(401).json({ error: "Unauthorized" });
}

async function authStudent(req, res, next) {
  const token = readStudentSessionToken(req);
  const session = verifyStudentSession(token, JWT_SECRET);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  const candidate = await findCandidateByEmail(session.email);
  if (!candidate || candidate.id !== session.candidateId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.candidate = candidate;
  req.studentSession = session;
  next();
}

app.get("/health", (req, res) => {
  const mail = getEmailConfig();
  let certificateTemplate = null;
  try {
    certificateTemplate = ensureTemplateFile();
  } catch (e) {
    certificateTemplate = null;
  }
  res.json({
    status: "ok",
    service: "pathway-prep-exams",
    commit: process.env.RENDER_GIT_COMMIT || null,
    email: {
      configured: mail.configured,
      from: mail.from?.email || null,
      domain: mail.domain || null
    },
    certificateTemplate: certificateTemplate ? path.basename(certificateTemplate) : null
  });
});

// ─── Student OTP auth ───────────────────────────────────────────────────────
app.post("/api/exam/student/request-code", otpLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  const candidate = await findCandidateByEmail(email);
  if (candidate) {
    const code = generateOtp();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await getDb().run(
      `INSERT INTO otp_codes (email, code_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         code_hash = excluded.code_hash,
         expires_at = excluded.expires_at,
         created_at = excluded.created_at`,
      [email, hashOtp(code), expires, new Date().toISOString()]
    );
    try {
      await sendOtpEmail(email, code);
    } catch (e) {
      console.error("OTP email failed:", e.message);
    }
  }

  res.json({
    ok: true,
    message: "If your email is registered with a training partner, a sign-in code was sent."
  });
});

app.post("/api/exam/student/verify", otpLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").trim();
  if (!email || !code) return res.status(400).json({ error: "Email and code are required." });

  const row = await getDb().get("SELECT * FROM otp_codes WHERE email = ?", [email]);
  if (!row || new Date(row.expires_at) < new Date()) {
    return res.status(401).json({ error: "Invalid or expired code." });
  }
  if (!secureCompare(hashOtp(code), row.code_hash)) {
    return res.status(401).json({ error: "Invalid or expired code." });
  }

  const candidate = await findCandidateByEmail(email);
  if (!candidate) return res.status(401).json({ error: "Invalid or expired code." });

  await getDb().run("DELETE FROM otp_codes WHERE email = ?", [email]);
  const token = signStudentSession(JWT_SECRET, candidate.id, email);
  setStudentSessionCookie(res, token, PUBLIC_URL);
  res.json({
    ok: true,
    candidate: {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      course_name: candidate.course_name || ""
    }
  });
});

app.delete("/api/exam/student/session", (req, res) => {
  clearStudentSessionCookie(res, PUBLIC_URL);
  res.json({ ok: true });
});

app.get("/api/exam/student/me", studentLimiter, authStudent, (req, res) => {
  res.json({
    id: req.candidate.id,
    name: req.candidate.name,
    email: req.candidate.email,
    course_name: req.candidate.course_name || ""
  });
});

// ─── Student exams ────────────────────────────────────────────────────────────
app.get("/api/exam/student/exams", studentLimiter, authStudent, async (req, res) => {
  const candidateCourse = String(req.candidate.course_name || "").trim();
  const rows = await getDb().all(
    `SELECT e.* FROM exams e WHERE e.status = 'published' ORDER BY e.created_at DESC`
  );
  const exams = [];
  for (const e of rows) {
    if (!courseMatches(candidateCourse, e.course_name)) continue;
    const status = await getCandidateExamStatus(e.id, req.candidate.id);
    exams.push({ ...e, ...status });
  }
  res.json({ exams, attemptsMax: MAX_ATTEMPTS_PER_EXAM });
});

app.get("/api/exam/student/attempts", studentLimiter, authStudent, async (req, res) => {
  const attempts = await getDb().all(
    `SELECT a.*, e.title AS exam_title, e.cutoff_percent
     FROM exam_attempts a
     JOIN exams e ON e.id = a.exam_id
     WHERE a.candidate_id = ?
     ORDER BY a.started_at DESC`,
    [req.candidate.id]
  );
  res.json({ attempts });
});

app.get("/api/exam/student/exams/:id/preview", studentLimiter, authStudent, async (req, res) => {
  try {
    const preview = await getExamPreview(req.params.id, req.candidate);
    res.json(preview);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post("/api/exam/student/exams/:id/start", studentLimiter, authStudent, async (req, res) => {
  try {
    const payload = await startAttempt(req.params.id, req.candidate);
    res.json(payload);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post("/api/exam/student/attempts/:id/answer", studentLimiter, authStudent, async (req, res) => {
  try {
    const { questionId, selectedIndex } = req.body || {};
    const result = await saveAnswer(
      req.params.id,
      req.candidate.id,
      questionId,
      selectedIndex
    );
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post("/api/exam/student/attempts/:id/submit", studentLimiter, authStudent, async (req, res) => {
  try {
    const result = await submitAttempt(req.params.id, req.candidate.id, req.candidate, {
      submitReason: req.body?.submitReason
    });
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.get("/api/exam/student/attempts/:id/result", studentLimiter, authStudent, async (req, res) => {
  try {
    const result = await getAttemptResult(req.params.id, req.candidate.id);
    res.json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ─── Admin auth ───────────────────────────────────────────────────────────────
app.post("/api/exam/admin/session", adminLimiter, (req, res) => {
  const apiKey = String(req.body?.apiKey || "").trim();
  if (!secureCompare(apiKey, ADMIN_KEY)) {
    return res.status(401).json({ error: "Invalid admin API key." });
  }
  const token = signAdminSession(JWT_SECRET);
  setAdminSessionCookie(res, token, PUBLIC_URL);
  res.json({ ok: true });
});

app.delete("/api/exam/admin/session", (req, res) => {
  clearAdminSessionCookie(res, PUBLIC_URL);
  res.json({ ok: true });
});

app.use(["/api/exam/admin"], adminLimiter);

app.get("/api/exam/admin/stats", authAdmin, async (req, res) => {
  const exams = await getDb().get("SELECT COUNT(*) AS n FROM exams");
  const published = await getDb().get("SELECT COUNT(*) AS n FROM exams WHERE status = 'published'");
  const attempts = await getDb().get("SELECT COUNT(*) AS n FROM exam_attempts WHERE submitted_at IS NOT NULL");
  const passed = await getDb().get("SELECT COUNT(*) AS n FROM exam_attempts WHERE passed = 1");
  res.json({
    exams: exams?.n || 0,
    published: published?.n || 0,
    attempts: attempts?.n || 0,
    passed: passed?.n || 0
  });
});

app.get("/api/exam/admin/courses", authAdmin, (req, res) => {
  res.json({ courses: COURSES });
});

// ─── Admin exams CRUD ─────────────────────────────────────────────────────────
app.get("/api/exam/admin/exams", authAdmin, async (req, res) => {
  const exams = await getDb().all(
    `SELECT e.*,
      (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_pool
     FROM exams e ORDER BY e.created_at DESC`
  );
  res.json({ exams });
});

app.post("/api/exam/admin/exams", authAdmin, async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || "").trim();
  const course_name = String(body.course_name || "").trim();
  if (!title || !course_name) {
    return res.status(400).json({ error: "Title and course are required." });
  }
  const id = newId("exam");
  const now = new Date().toISOString();
  const code = body.code ? String(body.code).trim().toUpperCase() : null;
  await getDb().run(
    `INSERT INTO exams
     (id, title, code, course_name, cutoff_percent, duration_minutes, question_count, shuffle_mode, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [
      id,
      title,
      code,
      course_name,
      Math.min(100, Math.max(0, parseInt(body.cutoff_percent, 10) || 70)),
      Math.min(180, Math.max(5, parseInt(body.duration_minutes, 10) || 30)),
      Math.max(1, parseInt(body.question_count, 10) || 10),
      body.shuffle_mode === "options_only" ? "options_only" : "questions",
      now,
      now
    ]
  );
  const exam = await getExamById(id);
  res.status(201).json({ exam });
});

app.get("/api/exam/admin/exams/:id", authAdmin, async (req, res) => {
  const exam = await getExamById(req.params.id);
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  const questions = await listQuestionsForExam(req.params.id);
  res.json({
    exam,
    questions: questions.map((q) => ({
      id: q.id,
      sort_order: q.sort_order,
      prompt: q.prompt,
      question_type: q.question_type || "multiple_choice",
      options: parseOptions(q.options_json),
      correct_index: q.correct_index
    }))
  });
});

app.patch("/api/exam/admin/exams/:id", authAdmin, async (req, res) => {
  const exam = await getExamById(req.params.id);
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  const body = req.body || {};
  const now = new Date().toISOString();
  await getDb().run(
    `UPDATE exams SET
      title = COALESCE(?, title),
      code = COALESCE(?, code),
      course_name = COALESCE(?, course_name),
      cutoff_percent = COALESCE(?, cutoff_percent),
      duration_minutes = COALESCE(?, duration_minutes),
      question_count = COALESCE(?, question_count),
      shuffle_mode = COALESCE(?, shuffle_mode),
      status = COALESCE(?, status),
      updated_at = ?
     WHERE id = ?`,
    [
      body.title ? String(body.title).trim() : null,
      body.code != null ? String(body.code).trim().toUpperCase() || null : null,
      body.course_name ? String(body.course_name).trim() : null,
      body.cutoff_percent != null ? parseInt(body.cutoff_percent, 10) : null,
      body.duration_minutes != null
        ? Math.min(180, Math.max(5, parseInt(body.duration_minutes, 10) || 30))
        : null,
      body.question_count != null ? parseInt(body.question_count, 10) : null,
      body.shuffle_mode || null,
      body.status || null,
      now,
      req.params.id
    ]
  );
  res.json({ exam: await getExamById(req.params.id) });
});

app.delete("/api/exam/admin/exams/:id", authAdmin, async (req, res) => {
  await getDb().run("DELETE FROM questions WHERE exam_id = ?", [req.params.id]);
  await getDb().run("DELETE FROM exams WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.post("/api/exam/admin/exams/:id/publish", authAdmin, async (req, res) => {
  const exam = await getExamById(req.params.id);
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  const count = await getDb().get(
    "SELECT COUNT(*) AS n FROM questions WHERE exam_id = ?",
    [req.params.id]
  );
  const pool = count?.n || 0;
  if (pool < 1) {
    return res.status(400).json({
      error: "Add at least one question before publishing. Upload an Excel file or add questions manually."
    });
  }
  const now = new Date().toISOString();
  const perAttempt = Math.min(exam.question_count, pool);
  await discardInProgressAttemptsForExam(req.params.id);
  await getDb().run(
    "UPDATE exams SET status = 'published', question_count = ?, updated_at = ?, published_at = ? WHERE id = ?",
    [perAttempt, now, now, req.params.id]
  );
  const wasPublished = exam.status === "published";
  res.json({
    exam: await getExamById(req.params.id),
    message: wasPublished
      ? `Republished — ${perAttempt} question(s) per attempt. Students now see the updated exam; in-progress attempts were cleared.`
      : `Published with ${perAttempt} question(s) per attempt.`
  });
});

// ─── Admin questions ──────────────────────────────────────────────────────────
app.post("/api/exam/admin/exams/:id/questions", authAdmin, async (req, res) => {
  const exam = await getExamById(req.params.id);
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  const q = normalizeQuestionInput(req.body || {});
  if (!q) return res.status(400).json({ error: "Invalid question data." });
  const id = newId("q");
  const now = new Date().toISOString();
  await getDb().run(
    `INSERT INTO questions
     (id, exam_id, sort_order, prompt, question_type, options_json, correct_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      req.params.id,
      parseInt(req.body?.sort_order, 10) || 0,
      q.prompt,
      q.question_type,
      JSON.stringify(q.options),
      q.correct_index,
      now
    ]
  );
  res.status(201).json({ id, ...q });
});

app.patch("/api/exam/admin/questions/:id", authAdmin, async (req, res) => {
  const body = req.body || {};
  const options = Array.isArray(body.options) ? body.options.map(String).filter(Boolean) : null;
  await getDb().run(
    `UPDATE questions SET
      prompt = COALESCE(?, prompt),
      options_json = COALESCE(?, options_json),
      correct_index = COALESCE(?, correct_index),
      sort_order = COALESCE(?, sort_order)
     WHERE id = ?`,
    [
      body.prompt ? String(body.prompt).trim() : null,
      options ? JSON.stringify(options) : null,
      body.correct_index != null ? parseInt(body.correct_index, 10) : null,
      body.sort_order != null ? parseInt(body.sort_order, 10) : null,
      req.params.id
    ]
  );
  res.json({ ok: true });
});

app.delete("/api/exam/admin/questions/:id", authAdmin, async (req, res) => {
  await getDb().run("DELETE FROM questions WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

app.post("/api/exam/admin/exams/:id/import/preview", authAdmin, async (req, res) => {
  const type = String(req.body?.type || "excel").toLowerCase();
  const b64 = String(req.body?.fileBase64 || "");
  if (!b64) return res.status(400).json({ error: "No file uploaded." });
  try {
    const buffer = Buffer.from(b64, "base64");
    const result =
      type === "pdf" ? await parsePdfBuffer(buffer) : parseExcelBuffer(buffer);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message || "Import failed." });
  }
});

app.post("/api/exam/admin/exams/:id/import/confirm", authAdmin, async (req, res) => {
  const exam = await getExamById(req.params.id);
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  const questions = Array.isArray(req.body?.questions) ? req.body.questions : [];
  if (!questions.length) return res.status(400).json({ error: "No questions to import." });
  const result = await importQuestionsForExam(req.params.id, questions, {
    replace: req.body?.replace !== false
  });
  res.json({
    imported: result.imported,
    pool: result.pool,
    message: `Imported ${result.imported} question(s).`
  });
});

app.post("/api/exam/admin/exams/:id/import/excel", authAdmin, async (req, res) => {
  const exam = await getExamById(req.params.id);
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  const b64 = String(req.body?.fileBase64 || "");
  if (!b64) return res.status(400).json({ error: "No file uploaded." });
  try {
    const buffer = Buffer.from(b64, "base64");
    const parsed = parseExcelBuffer(buffer);
    if (!parsed.questions.length) {
      return res.status(400).json({
        error: parsed.errors[0] || "No valid questions found in the Excel file.",
        errors: parsed.errors
      });
    }
    const result = await importQuestionsForExam(req.params.id, parsed.questions, { replace: true });
    res.json({
      imported: result.imported,
      pool: result.pool,
      errors: parsed.errors,
      message: `Imported ${result.imported} question(s) from Excel.`
    });
  } catch (e) {
    res.status(400).json({ error: e.message || "Import failed." });
  }
});

app.get("/api/exam/admin/email/status", authAdmin, (req, res) => {
  const email = getEmailConfig();
  let certificateTemplate = null;
  try {
    certificateTemplate = ensureTemplateFile();
  } catch (e) {
    certificateTemplate = null;
  }
  res.json({
    configured: email.configured,
    apiKeySet: email.apiKeySet,
    from: email.fromDisplay,
    domain: email.domain,
    replyTo: email.replyTo,
    brand: email.brand,
    sandboxOnly: email.sandboxOnly,
    sandboxNote: email.sandboxNote,
    certificateTemplate: certificateTemplate ? path.basename(certificateTemplate) : null
  });
});

app.post("/api/exam/admin/email/test-certificate", authAdmin, async (req, res) => {
  const to = String(req.body?.to || "").trim().toLowerCase();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return res.status(400).json({ error: "Valid recipient email required." });
  }
  try {
    const { buffer: pdfBuffer, filename: pdfFilename } = await generateExamCertificatePdf({
      studentName: "Test Candidate",
      examTitle: "Sample Exam",
      courseName: "Health Care Assistant"
    });
    const result = await sendExamCertificateEmail({
      to,
      studentName: "Test Candidate",
      examTitle: "Sample Exam",
      courseName: "Health Care Assistant",
      scorePercent: 85,
      cutoffPercent: 70,
      batch: "May",
      agentName: "Sample Agent Ltd",
      certificateId: "PP-CERT-TEST1234",
      pdfBuffer,
      pdfFilename
    });
    res.json({
      ok: true,
      message: result.dev
        ? "Dev mode: logged to console (set RESEND_API_KEY to send for real)."
        : `Test certificate email sent to ${to}.`,
      messageId: result.id || null
    });
  } catch (e) {
    console.error("Certificate email test failed:", e.message);
    res.status(503).json({ error: e.message });
  }
});

app.get("/api/exam/admin/attempts", authAdmin, async (req, res) => {
  const attempts = await getDb().all(
    `SELECT a.*, e.title AS exam_title, c.name AS candidate_name, c.email AS candidate_email
     FROM exam_attempts a
     JOIN exams e ON e.id = a.exam_id
     LEFT JOIN candidates c ON c.id = a.candidate_id
     WHERE a.submitted_at IS NOT NULL
     ORDER BY a.submitted_at DESC
     LIMIT 200`
  );
  res.json({ attempts });
});

app.get("/api/exam/admin/attempts/export", authAdmin, async (req, res) => {
  const attempts = await getDb().all(
    `SELECT a.score_percent, a.passed, a.submitted_at, a.started_at, a.submit_reason,
            e.title AS exam_title, c.name AS candidate_name, c.email AS candidate_email
     FROM exam_attempts a
     JOIN exams e ON e.id = a.exam_id
     LEFT JOIN candidates c ON c.id = a.candidate_id
     WHERE a.submitted_at IS NOT NULL
     ORDER BY a.submitted_at DESC`
  );
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    "Student,Email,Exam,Score,Result,Submit reason,Submitted,Started",
    ...attempts.map((a) =>
      [
        esc(a.candidate_name),
        esc(a.candidate_email),
        esc(a.exam_title),
        esc(a.score_percent),
        esc(a.passed ? "Passed" : "Failed"),
        esc(a.submit_reason || "review"),
        esc(a.submitted_at),
        esc(a.started_at)
      ].join(",")
    )
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="pathway-prep-exam-results.csv"');
  res.send(lines.join("\n"));
});

app.get("/api/exam/admin/reschedules", authAdmin, async (req, res) => {
  const exhausted = await listExhaustedCandidateExams();
  res.json({ exhausted, attemptsMax: MAX_ATTEMPTS_PER_EXAM });
});

app.post("/api/exam/admin/reschedules", authAdmin, async (req, res) => {
  const examId = String(req.body?.exam_id || "").trim();
  const candidateId = String(req.body?.candidate_id || "").trim();
  const note = req.body?.note;
  if (!examId || !candidateId) {
    return res.status(400).json({ error: "exam_id and candidate_id are required." });
  }
  try {
    const result = await rescheduleCandidateExam(examId, candidateId, note);
    res.status(201).json(result);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post("/api/exam/admin/attempts/:id/resend-certificate", authAdmin, async (req, res) => {
  const row = await getDb().get(
    `SELECT a.*, c.name AS candidate_name, c.email AS candidate_email, c.batch AS candidate_batch,
            c.course_name AS candidate_course_name, co.company_name AS candidate_agent_name
     FROM exam_attempts a
     LEFT JOIN candidates c ON c.id = a.candidate_id
     LEFT JOIN companies co ON co.id = c.company_id
     WHERE a.id = ?`,
    [req.params.id]
  );
  if (!row || !row.submitted_at) {
    return res.status(404).json({ error: "Submitted attempt not found." });
  }
  if (!row.passed) {
    return res.status(400).json({ error: "Certificate is only sent for passing attempts." });
  }
  const exam = await getExamById(row.exam_id);
  if (!exam) return res.status(404).json({ error: "Exam not found." });
  const result = await deliverPassCertificate({
    attemptId: row.id,
    exam,
    candidateId: row.candidate_id,
    candidateRow: {
      id: row.candidate_id,
      name: row.candidate_name,
      email: row.candidate_email,
      batch: row.candidate_batch,
      course_name: row.candidate_course_name,
      company_name: row.candidate_agent_name
    },
    scorePercent: row.score_percent,
    forceResend: true
  });
  if (!result.certificateSent) {
    return res.status(500).json({ error: result.error || "Certificate send failed." });
  }
  res.json({ ok: true, certificateSent: true, alreadySent: !!result.alreadySent });
});

app.get("/assets/question-import-template.xlsx", (req, res) => {
  const p = path.join(__dirname, "assets", "question-import-template.xlsx");
  if (!fs.existsSync(p)) return res.status(404).end();
  res.download(p);
});

// ─── Static UI ────────────────────────────────────────────────────────────────
const uiOut = path.join(__dirname, "exam-portal-design", "out");
const uiBuilt = fs.existsSync(path.join(uiOut, "index.html"));

if (!uiBuilt) {
  console.warn(
    "Exam UI not built — run `npm run exam:build` during deploy. Pages will return Cannot GET /."
  );
}

if (uiBuilt) {
  app.use(express.static(uiOut, { index: false, redirect: false }));
  const withTrailingSlash = (p) => (p.endsWith("/") ? p : `${p}/`);
  const sendPage = (segments, withSlash) => (req, res) => {
    if (withTrailingSlash(req.path) !== withTrailingSlash(withSlash)) {
      res.setHeader("Cache-Control", "no-store");
      return res.redirect(301, withTrailingSlash(withSlash));
    }
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    res.sendFile(path.join(uiOut, ...segments, "index.html"));
  };
  app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(uiOut, "index.html")));
  app.get(["/verify", "/verify/"], sendPage(["verify"], "/verify/"));
  app.get(["/dashboard", "/dashboard/"], sendPage(["dashboard"], "/dashboard/"));
  app.get(["/exam", "/exam/"], sendPage(["exam"], "/exam/"));
  app.get(["/result", "/result/"], sendPage(["result"], "/result/"));
  app.get(["/admin", "/admin/"], sendPage(["admin"], "/admin/"));
  app.get(["/admin/dashboard", "/admin/dashboard/"], sendPage(["admin", "dashboard"], "/admin/dashboard/"));
  app.get(["/admin/exams", "/admin/exams/"], sendPage(["admin", "exams"], "/admin/exams/"));
  app.get(["/admin/exams/questions", "/admin/exams/questions/"], sendPage(["admin", "exams", "questions"], "/admin/exams/questions/"));
  app.get(["/admin/attempts", "/admin/attempts/"], sendPage(["admin", "attempts"], "/admin/attempts/"));
}

app.use(express.static(path.join(__dirname, "public")));

async function start() {
  await initDb(path.join(__dirname, "data"));
  try {
    const tpl = ensureTemplateFile();
    console.log(`Certificate template: ${tpl}`);
  } catch (e) {
    console.error("Certificate template error:", e.message);
  }
  const mail = getEmailConfig();
  if (mail.configured) {
    console.log(`Email: Resend configured (${mail.from?.email})`);
  } else {
    console.warn("Email: Resend NOT configured — set RESEND_API_KEY and RESEND_FROM on this Render service.");
  }
  app.listen(PORT, () => {
    console.log("Pathway Prep Exams");
    console.log(`  Student:  ${PUBLIC_URL}/`);
    console.log(`  Admin:    ${PUBLIC_URL}/admin/`);
    console.log(`  Home:     ${HOME_URL}`);
  });
}

start().catch((e) => {
  console.error("Failed to start:", e);
  process.exit(1);
});
