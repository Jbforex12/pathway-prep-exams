const crypto = require("crypto");
const { getDb, findCandidateById } = require("../db");
const { newId } = require("./security");
const { sendExamCertificateEmail, sendExamFailEmail, sendExamIntegrityEmail } = require("./email");
const { generateExamCertificatePdf } = require("./exam-certificate");

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleOptionIndices(len) {
  const indices = Array.from({ length: len }, (_, i) => i);
  return shuffle(indices);
}

function parseOptions(json) {
  try {
    const opts = JSON.parse(json);
    return Array.isArray(opts) ? opts.map(String) : [];
  } catch {
    return [];
  }
}

const { courseMatches } = require("./course-match");

const MAX_ATTEMPTS_PER_EXAM = 2;

async function getLatestResetAt(examId, candidateId) {
  const row = await getDb().get(
    `SELECT reset_at FROM exam_attempt_resets
     WHERE exam_id = ? AND candidate_id = ?
     ORDER BY reset_at DESC LIMIT 1`,
    [examId, candidateId]
  );
  return row?.reset_at || null;
}

async function countSubmittedAttempts(examId, candidateId) {
  const resetAt = await getLatestResetAt(examId, candidateId);
  const args = [examId, candidateId];
  let sql = `SELECT COUNT(*) AS n FROM exam_attempts
     WHERE exam_id = ? AND candidate_id = ? AND submitted_at IS NOT NULL`;
  if (resetAt) {
    sql += " AND submitted_at > ?";
    args.push(resetAt);
  }
  const row = await getDb().get(sql, args);
  return row?.n || 0;
}

async function getCandidateExamStatus(examId, candidateId) {
  const attemptsUsed = await countSubmittedAttempts(examId, candidateId);
  return {
    attemptsUsed,
    attemptsMax: MAX_ATTEMPTS_PER_EXAM,
    canTake: attemptsUsed < MAX_ATTEMPTS_PER_EXAM
  };
}

async function listExhaustedCandidateExams() {
  const pairs = await getDb().all(
    `SELECT DISTINCT a.candidate_id, a.exam_id,
      c.name AS candidate_name, c.email AS candidate_email,
      e.title AS exam_title
     FROM exam_attempts a
     JOIN exams e ON e.id = a.exam_id
     LEFT JOIN candidates c ON c.id = a.candidate_id
     WHERE a.submitted_at IS NOT NULL AND a.candidate_id IS NOT NULL`
  );
  const exhausted = [];
  for (const row of pairs) {
    const attemptsUsed = await countSubmittedAttempts(row.exam_id, row.candidate_id);
    const passed = await hasPassedAttempt(row.exam_id, row.candidate_id);
    if (attemptsUsed >= MAX_ATTEMPTS_PER_EXAM && !passed) {
      exhausted.push({
        candidate_id: row.candidate_id,
        exam_id: row.exam_id,
        candidate_name: row.candidate_name || "",
        candidate_email: row.candidate_email || "",
        exam_title: row.exam_title || "",
        attemptsUsed,
        attemptsMax: MAX_ATTEMPTS_PER_EXAM,
        last_reset_at: await getLatestResetAt(row.exam_id, row.candidate_id)
      });
    }
  }
  exhausted.sort((a, b) =>
    String(a.candidate_name).localeCompare(String(b.candidate_name)) ||
    String(a.exam_title).localeCompare(String(b.exam_title))
  );
  return exhausted;
}

async function rescheduleCandidateExam(examId, candidateId, note) {
  const exam = await getExamById(examId);
  if (!exam) {
    const err = new Error("Exam not found.");
    err.status = 404;
    throw err;
  }
  const candidate = await getDb().get("SELECT id FROM candidates WHERE id = ?", [candidateId]);
  if (!candidate) {
    const err = new Error("Candidate not found.");
    err.status = 404;
    throw err;
  }
  if (await hasPassedAttempt(examId, candidateId)) {
    const err = new Error("Candidate already passed this exam.");
    err.status = 409;
    throw err;
  }
  const attemptsUsed = await countSubmittedAttempts(examId, candidateId);
  if (attemptsUsed < MAX_ATTEMPTS_PER_EXAM) {
    const err = new Error("Candidate still has attempts remaining for this exam.");
    err.status = 409;
    throw err;
  }
  const now = new Date().toISOString();
  const id = newId("rst");
  await getDb().run(
    `INSERT INTO exam_attempt_resets (id, exam_id, candidate_id, reset_at, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, examId, candidateId, now, note ? String(note).trim() : null, now]
  );
  return {
    ok: true,
    reset_id: id,
    reset_at: now,
    attemptsUsed: 0,
    attemptsMax: MAX_ATTEMPTS_PER_EXAM,
    canTake: true
  };
}

async function hasPassedAttempt(examId, candidateId, excludeAttemptId = null) {
  const args = [examId, candidateId];
  let sql = `SELECT id FROM exam_attempts
     WHERE exam_id = ? AND candidate_id = ? AND submitted_at IS NOT NULL AND passed = 1`;
  if (excludeAttemptId) {
    sql += " AND id != ?";
    args.push(excludeAttemptId);
  }
  sql += " LIMIT 1";
  const row = await getDb().get(sql, args);
  return Boolean(row);
}

async function hasCertificateBeenSent(examId, candidateId) {
  const row = await getDb().get(
    `SELECT id FROM exam_attempts
     WHERE exam_id = ? AND candidate_id = ? AND certificate_sent_at IS NOT NULL
     LIMIT 1`,
    [examId, candidateId]
  );
  return Boolean(row);
}

async function deliverPassCertificate({
  attemptId,
  exam,
  candidateId,
  candidateRow,
  scorePercent,
  forceResend = false
}) {
  const cid = candidateId || candidateRow?.id;
  const email = String(candidateRow?.email || "").trim().toLowerCase();
  const studentName = String(candidateRow?.name || "").trim();
  if (!email) {
    return { certificateSent: false, error: "Candidate has no email on file." };
  }
  if (!cid) {
    return { certificateSent: false, error: "Candidate id missing." };
  }
  if (!forceResend && (await hasCertificateBeenSent(exam.id, cid))) {
    return { certificateSent: true, alreadySent: true };
  }

  const now = new Date().toISOString();
  const certId = `PP-CERT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const fullCandidate = (await findCandidateById(cid)) || candidateRow;
  const courseName = exam.course_name || fullCandidate?.course_name || exam.title;
  const batch = String(fullCandidate?.batch || "").trim();
  const agentName = String(fullCandidate?.company_name || "").trim();
  try {
    console.log(
      `Sending pass certificate: attempt=${attemptId} exam=${exam.id} candidate=${cid} email=${email}`
    );
    const { buffer: pdfBuffer, filename: pdfFilename } = await generateExamCertificatePdf({
      studentName,
      examTitle: exam.title,
      courseName: exam.course_name
    });
    await sendExamCertificateEmail({
      to: email,
      studentName,
      examTitle: exam.title,
      courseName,
      scorePercent,
      cutoffPercent: exam.cutoff_percent,
      batch,
      agentName,
      certificateId: certId,
      pdfBuffer,
      pdfFilename
    });
    await getDb().run(
      "UPDATE exam_attempts SET certificate_sent_at = ?, certificate_id = ? WHERE id = ?",
      [now, certId, attemptId]
    );
    console.log(`Certificate email sent: attempt=${attemptId} cert=${certId}`);
    return { certificateSent: true };
  } catch (e) {
    console.error("Certificate email failed:", e.message, e.stack || "");
    return { certificateSent: false, error: e.message };
  }
}

function normalizeSubmitReason(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "tab_switch" || s === "timeout") return s;
  return "review";
}

async function deliverAttemptResultEmails({
  attemptId,
  exam,
  candidateId,
  candidateRow,
  scorePercent,
  passed,
  submitReason,
  skipIfSent = true
}) {
  const db = getDb();
  const attemptRow = await db.get(
    "SELECT result_email_sent_at, submit_reason FROM exam_attempts WHERE id = ?",
    [attemptId]
  );
  if (skipIfSent && attemptRow?.result_email_sent_at) {
    return { resultEmailSent: true, alreadySent: true };
  }

  const fullCandidate = (await findCandidateById(candidateId)) || candidateRow;
  const email = String(fullCandidate?.email || "").trim().toLowerCase();
  if (!email) {
    console.warn(`Result email skipped: no email for candidate=${candidateId} attempt=${attemptId}`);
    return { resultEmailSent: false, error: "Candidate has no email on file." };
  }

  const reason = normalizeSubmitReason(submitReason ?? attemptRow?.submit_reason);
  const emailFields = {
    studentName: fullCandidate?.name,
    examTitle: exam.title,
    courseName: exam.course_name || fullCandidate?.course_name || exam.title,
    scorePercent,
    cutoffPercent: exam.cutoff_percent,
    batch: String(fullCandidate?.batch || "").trim(),
    agentName: String(fullCandidate?.company_name || "").trim()
  };

  const now = new Date().toISOString();
  try {
    if (reason === "tab_switch") {
      console.log(
        `Sending integrity email: attempt=${attemptId} candidate=${candidateId} email=${email}`
      );
      await sendExamIntegrityEmail({ to: email, ...emailFields, passed: !!passed });
    } else if (!passed) {
      console.log(`Sending fail email: attempt=${attemptId} candidate=${candidateId} email=${email}`);
      await sendExamFailEmail({ to: email, ...emailFields, submitReason: reason });
    } else {
      return { resultEmailSent: false, skipped: true };
    }
    await db.run("UPDATE exam_attempts SET result_email_sent_at = ? WHERE id = ?", [now, attemptId]);
    console.log(
      `Result email sent: attempt=${attemptId} type=${reason === "tab_switch" ? "integrity" : "fail"}`
    );
    return { resultEmailSent: true };
  } catch (e) {
    console.error(`Result email failed: attempt=${attemptId}`, e.message, e.stack || "");
    return { resultEmailSent: false, error: e.message };
  }
}

async function retryMissingResultEmail(row, exam, candidateId, candidateRow) {
  if (!row || row.result_email_sent_at || !exam) return;
  const reason = normalizeSubmitReason(row.submit_reason);
  if (reason !== "tab_switch" && row.passed) return;
  await deliverAttemptResultEmails({
    attemptId: row.id,
    exam,
    candidateId,
    candidateRow,
    scorePercent: row.score_percent,
    passed: !!row.passed,
    submitReason: reason,
    skipIfSent: true
  });
}

async function getExamById(examId) {
  return getDb().get("SELECT * FROM exams WHERE id = ?", [examId]);
}

async function listQuestionsForExam(examId) {
  return getDb().all(
    "SELECT * FROM questions WHERE exam_id = ? ORDER BY sort_order ASC, created_at ASC",
    [examId]
  );
}

function examPublishedAt(exam) {
  return exam?.published_at || exam?.updated_at || null;
}

function isAttemptStale(attempt, exam) {
  const pub = examPublishedAt(exam);
  if (!pub || !attempt) return false;
  const stamp = attempt.exam_published_at || attempt.started_at;
  if (!stamp) return true;
  return String(stamp) < String(pub);
}

async function discardInProgressAttemptsForExam(examId) {
  await getDb().run(
    "DELETE FROM exam_attempts WHERE exam_id = ? AND submitted_at IS NULL",
    [examId]
  );
}

async function getExamPreview(examId, candidate) {
  const db = getDb();
  const exam = await getExamById(examId);
  if (!exam || exam.status !== "published") {
    const err = new Error("Exam not available.");
    err.status = 404;
    throw err;
  }
  if (!courseMatches(candidate.course_name, exam.course_name)) {
    const err = new Error("This exam is not available for your course.");
    err.status = 403;
    throw err;
  }

  const attemptsUsed = await countSubmittedAttempts(examId, candidate.id);
  const inProgress = await db.get(
    `SELECT id FROM exam_attempts
     WHERE exam_id = ? AND candidate_id = ? AND submitted_at IS NULL`,
    [examId, candidate.id]
  );
  const pool = await listQuestionsForExam(examId);
  const durationMinutes = Math.min(180, Math.max(5, parseInt(exam.duration_minutes, 10) || 30));
  const publishedAt = examPublishedAt(exam);
  const lastSubmitted = await db.get(
    `SELECT MAX(submitted_at) AS submitted_at FROM exam_attempts
     WHERE exam_id = ? AND candidate_id = ? AND submitted_at IS NOT NULL`,
    [examId, candidate.id]
  );
  const revisedSinceLastAttempt =
    Boolean(publishedAt && lastSubmitted?.submitted_at) &&
    String(lastSubmitted.submitted_at) < String(publishedAt);

  return {
    examId: exam.id,
    examTitle: exam.title,
    durationMinutes,
    questionCount: exam.question_count,
    cutoffPercent: exam.cutoff_percent,
    poolSize: pool.length,
    attemptsUsed,
    attemptsMax: MAX_ATTEMPTS_PER_EXAM,
    canTake: attemptsUsed < MAX_ATTEMPTS_PER_EXAM || Boolean(inProgress),
    hasInProgress: Boolean(inProgress),
    inProgressAttemptId: inProgress?.id || null,
    publishedAt,
    revisedSinceLastAttempt
  };
}

async function startAttempt(examId, candidate) {
  const db = getDb();
  const exam = await getExamById(examId);
  if (!exam || exam.status !== "published") {
    const err = new Error("Exam not available.");
    err.status = 404;
    throw err;
  }
  if (!courseMatches(candidate.course_name, exam.course_name)) {
    const err = new Error("This exam is not available for your course.");
    err.status = 403;
    throw err;
  }

  const attemptsUsed = await countSubmittedAttempts(examId, candidate.id);
  if (attemptsUsed >= MAX_ATTEMPTS_PER_EXAM) {
    const err = new Error("You have used both attempts for this exam.");
    err.status = 409;
    throw err;
  }

  const inProgress = await db.get(
    `SELECT * FROM exam_attempts
     WHERE exam_id = ? AND candidate_id = ? AND submitted_at IS NULL`,
    [examId, candidate.id]
  );
  if (inProgress) {
    if (isAttemptStale(inProgress, exam)) {
      await db.run("DELETE FROM exam_attempts WHERE id = ?", [inProgress.id]);
    } else {
      const resumed = await resumeAttempt(inProgress);
      resumed.studentName = String(candidate.name || "").trim();
      return resumed;
    }
  }

  const pool = await listQuestionsForExam(examId);
  if (pool.length < exam.question_count) {
    const err = new Error("Exam does not have enough questions configured.");
    err.status = 503;
    throw err;
  }

  let selected = pool;
  if (exam.shuffle_mode === "questions" || pool.length > exam.question_count) {
    selected = shuffle(pool).slice(0, exam.question_count);
  } else {
    selected = pool.slice(0, exam.question_count);
  }

  const questionOrder = selected.map((q) => q.id);
  const optionMaps = {};
  for (const q of selected) {
    const opts = parseOptions(q.options_json);
    optionMaps[q.id] = shuffleOptionIndices(opts.length);
  }

  const attemptId = newId("att");
  const now = new Date().toISOString();
  const durationMinutes = Math.min(180, Math.max(5, parseInt(exam.duration_minutes, 10) || 30));
  const publishStamp = examPublishedAt(exam) || now;
  await db.run(
    `INSERT INTO exam_attempts
     (id, exam_id, candidate_id, started_at, duration_minutes, question_order_json, option_maps_json, answers_json, exam_published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attemptId,
      examId,
      candidate.id,
      now,
      durationMinutes,
      JSON.stringify(questionOrder),
      JSON.stringify(optionMaps),
      JSON.stringify({}),
      publishStamp
    ]
  );

  const payload = await buildAttemptPayload(attemptId, exam, questionOrder, optionMaps, {}, now, durationMinutes);
  payload.studentName = String(candidate.name || "").trim();
  return payload;
}

async function resumeAttempt(row) {
  const exam = await getExamById(row.exam_id);
  const questionOrder = JSON.parse(row.question_order_json || "[]");
  const optionMaps = JSON.parse(row.option_maps_json || "{}");
  const answers = JSON.parse(row.answers_json || "{}");
  return buildAttemptPayload(
    row.id,
    exam,
    questionOrder,
    optionMaps,
    answers,
    row.started_at,
    row.duration_minutes ?? exam.duration_minutes
  );
}

async function buildAttemptPayload(attemptId, exam, questionOrder, optionMaps, answers, startedAt, durationOverride) {
  const db = getDb();
  const questions = [];
  for (const qid of questionOrder) {
    const q = await db.get("SELECT * FROM questions WHERE id = ?", [qid]);
    if (!q) continue;
    const opts = parseOptions(q.options_json);
    const map = optionMaps[qid] || opts.map((_, i) => i);
    const shuffledOptions = map.map((i) => opts[i]);
    questions.push({
      id: q.id,
      prompt: q.prompt,
      question_type: q.question_type || "multiple_choice",
      options: shuffledOptions
    });
  }

  const durationMinutes = durationOverride ?? exam.duration_minutes;
  const endsAt = new Date(new Date(startedAt).getTime() + durationMinutes * 60 * 1000).toISOString();

  return {
    attemptId,
    examId: exam.id,
    examTitle: exam.title,
    durationMinutes,
    startedAt,
    endsAt,
    questions,
    answers,
    questionOrder,
    studentName: ""
  };
}

async function saveAnswer(attemptId, candidateId, questionId, selectedIndex) {
  const db = getDb();
  const row = await db.get(
    "SELECT * FROM exam_attempts WHERE id = ? AND candidate_id = ? AND submitted_at IS NULL",
    [attemptId, candidateId]
  );
  if (!row) {
    const err = new Error("Attempt not found or already submitted.");
    err.status = 404;
    throw err;
  }
  const answers = JSON.parse(row.answers_json || "{}");
  answers[questionId] = Number(selectedIndex);
  await db.run("UPDATE exam_attempts SET answers_json = ? WHERE id = ?", [
    JSON.stringify(answers),
    attemptId
  ]);
  return { ok: true };
}

async function submitAttempt(attemptId, candidateId, candidateRow, opts = {}) {
  const submitReason = normalizeSubmitReason(opts.submitReason);
  const db = getDb();
  const row = await db.get(
    "SELECT * FROM exam_attempts WHERE id = ? AND candidate_id = ?",
    [attemptId, candidateId]
  );
  if (!row) {
    const err = new Error("Attempt not found.");
    err.status = 404;
    throw err;
  }
  const exam = await getExamById(row.exam_id);
  if (!exam) {
    const err = new Error("Exam not found.");
    err.status = 404;
    throw err;
  }

  if (row.submitted_at) {
    const priorReason = normalizeSubmitReason(row.submit_reason);
    if (row.passed && priorReason !== "tab_switch" && !row.certificate_sent_at) {
      await deliverPassCertificate({
        attemptId: row.id,
        exam,
        candidateId,
        candidateRow,
        scorePercent: row.score_percent
      });
    }
    await retryMissingResultEmail(row, exam, candidateId, candidateRow);
    return getAttemptResult(row.id, candidateId);
  }
  const questionOrder = JSON.parse(row.question_order_json || "[]");
  const optionMaps = JSON.parse(row.option_maps_json || "{}");
  const answers = JSON.parse(row.answers_json || "{}");

  let correct = 0;
  const breakdown = [];
  for (const qid of questionOrder) {
    const q = await db.get("SELECT * FROM questions WHERE id = ?", [qid]);
    if (!q) continue;
    const map = optionMaps[qid] || [];
    const selectedShuffled = answers[qid];
    const originalSelected =
      selectedShuffled === undefined || selectedShuffled === null
        ? null
        : map[selectedShuffled];
    const isCorrect = originalSelected === q.correct_index;
    if (isCorrect) correct += 1;
    breakdown.push({
      questionId: qid,
      prompt: q.prompt,
      correct: isCorrect,
      selectedIndex: selectedShuffled ?? null
    });
  }

  const total = questionOrder.length || 1;
  const scorePercent = Math.round((correct / total) * 100);
  const passed = scorePercent >= Number(exam.cutoff_percent || 0) ? 1 : 0;
  const now = new Date().toISOString();

  await db.run(
    `UPDATE exam_attempts
     SET submitted_at = ?, score_percent = ?, passed = ?, answers_json = ?, submit_reason = ?
     WHERE id = ?`,
    [now, scorePercent, passed, JSON.stringify(answers), submitReason, attemptId]
  );

  let certificateSent = false;
  let resultEmailSent = false;

  if (submitReason === "tab_switch" || !passed) {
    const mail = await deliverAttemptResultEmails({
      attemptId,
      exam,
      candidateId,
      candidateRow,
      scorePercent,
      passed: !!passed,
      submitReason,
      skipIfSent: false
    });
    resultEmailSent = !!mail.resultEmailSent;
  } else {
    const cert = await deliverPassCertificate({
      attemptId,
      exam,
      candidateId,
      candidateRow,
      scorePercent
    });
    certificateSent = cert.certificateSent;
    resultEmailSent = cert.certificateSent;
  }

  return {
    attemptId,
    examId: exam.id,
    examTitle: exam.title,
    scorePercent,
    passed: !!passed,
    cutoffPercent: exam.cutoff_percent,
    correct,
    total,
    breakdown,
    certificateSent,
    resultEmailSent,
    submitReason,
    integrityViolation: submitReason === "tab_switch",
    attemptNumber: await countSubmittedAttempts(row.exam_id, candidateId),
    attemptsMax: MAX_ATTEMPTS_PER_EXAM,
    submittedAt: now
  };
}

async function getAttemptResult(attemptId, candidateId) {
  const db = getDb();
  let row = await db.get(
    "SELECT * FROM exam_attempts WHERE id = ? AND candidate_id = ?",
    [attemptId, candidateId]
  );
  if (!row || !row.submitted_at) {
    const err = new Error("Result not found.");
    err.status = 404;
    throw err;
  }
  const exam = await getExamById(row.exam_id);
  const candidate = await findCandidateById(candidateId);
  const priorReason = normalizeSubmitReason(row.submit_reason);
  if (row.passed && priorReason !== "tab_switch" && !row.certificate_sent_at && exam && candidate?.email) {
    await deliverPassCertificate({
      attemptId: row.id,
      exam,
      candidateId,
      candidateRow: candidate,
      scorePercent: row.score_percent
    });
    row = await db.get(
      "SELECT * FROM exam_attempts WHERE id = ? AND candidate_id = ?",
      [attemptId, candidateId]
    );
  }
  await retryMissingResultEmail(row, exam, candidateId, candidate);
  row = await db.get(
    "SELECT * FROM exam_attempts WHERE id = ? AND candidate_id = ?",
    [attemptId, candidateId]
  );

  const questionOrder = JSON.parse(row.question_order_json || "[]");
  const optionMaps = JSON.parse(row.option_maps_json || "{}");
  const answers = JSON.parse(row.answers_json || "{}");

  let correct = 0;
  const breakdown = [];
  for (const qid of questionOrder) {
    const q = await db.get("SELECT * FROM questions WHERE id = ?", [qid]);
    if (!q) continue;
    const map = optionMaps[qid] || [];
    const selectedShuffled = answers[qid];
    const originalSelected =
      selectedShuffled === undefined || selectedShuffled === null
        ? null
        : map[selectedShuffled];
    const isCorrect = originalSelected === q.correct_index;
    if (isCorrect) correct += 1;
    breakdown.push({ questionId: qid, prompt: q.prompt, correct: isCorrect });
  }

  const attemptNumber = await countSubmittedAttempts(exam.id, candidateId);

  return {
    attemptId: row.id,
    examId: exam.id,
    examTitle: exam.title,
    scorePercent: row.score_percent,
    passed: !!row.passed,
    cutoffPercent: exam.cutoff_percent,
    correct,
    total: questionOrder.length,
    breakdown,
    certificateSent: !!row.certificate_sent_at,
    resultEmailSent: !!row.certificate_sent_at || !!row.result_email_sent_at,
    submitReason: row.submit_reason || "review",
    integrityViolation: row.submit_reason === "tab_switch",
    attemptNumber,
    attemptsMax: MAX_ATTEMPTS_PER_EXAM,
    canRetake: attemptNumber < MAX_ATTEMPTS_PER_EXAM,
    submittedAt: row.submitted_at
  };
}

async function adminResendResultEmail(attemptId, { force = false } = {}) {
  const db = getDb();
  const row = await db.get("SELECT * FROM exam_attempts WHERE id = ?", [attemptId]);
  if (!row?.submitted_at) {
    const err = new Error("Submitted attempt not found.");
    err.status = 404;
    throw err;
  }
  const reason = normalizeSubmitReason(row.submit_reason);
  if (reason !== "tab_switch" && row.passed) {
    const err = new Error("Result email applies to failed or integrity attempts only.");
    err.status = 400;
    throw err;
  }
  const exam = await getExamById(row.exam_id);
  if (!exam) {
    const err = new Error("Exam not found.");
    err.status = 404;
    throw err;
  }
  const candidate = await findCandidateById(row.candidate_id);
  const result = await deliverAttemptResultEmails({
    attemptId: row.id,
    exam,
    candidateId: row.candidate_id,
    candidateRow: candidate,
    scorePercent: row.score_percent,
    passed: !!row.passed,
    submitReason: reason,
    skipIfSent: !force
  });
  if (!result.resultEmailSent) {
    const err = new Error(result.error || "Result email send failed.");
    err.status = 500;
    throw err;
  }
  return result;
}

module.exports = {
  MAX_ATTEMPTS_PER_EXAM,
  getExamById,
  listQuestionsForExam,
  getCandidateExamStatus,
  getExamPreview,
  discardInProgressAttemptsForExam,
  listExhaustedCandidateExams,
  rescheduleCandidateExam,
  deliverPassCertificate,
  adminResendResultEmail,
  startAttempt,
  saveAnswer,
  submitAttempt,
  getAttemptResult,
  parseOptions
};
