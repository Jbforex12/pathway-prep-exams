const crypto = require("crypto");
const { getDb } = require("../db");
const { newId } = require("./security");
const { sendExamCertificateEmail, sendExamFailEmail } = require("./email");
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

async function deliverPassCertificate({ attemptId, exam, candidateRow, scorePercent }) {
  const email = String(candidateRow?.email || "").trim();
  if (!email) {
    return { certificateSent: false, error: "Candidate has no email on file." };
  }
  if (await hasCertificateBeenSent(exam.id, candidateRow.id)) {
    return { certificateSent: true, alreadySent: true };
  }

  const now = new Date().toISOString();
  const certId = newId("cert");
  try {
    const { buffer: pdfBuffer, filename: pdfFilename } = await generateExamCertificatePdf({
      studentName: candidateRow.name,
      examTitle: exam.title,
      courseName: exam.course_name
    });
    await sendExamCertificateEmail({
      to: email,
      studentName: candidateRow.name,
      examTitle: exam.title,
      scorePercent,
      cutoffPercent: exam.cutoff_percent,
      pdfBuffer,
      pdfFilename
    });
    await getDb().run(
      "UPDATE exam_attempts SET certificate_sent_at = ?, certificate_id = ? WHERE id = ?",
      [now, certId, attemptId]
    );
    return { certificateSent: true };
  } catch (e) {
    console.error("Certificate email failed:", e.message, e.stack || "");
    return { certificateSent: false, error: e.message };
  }
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
    return resumeAttempt(inProgress);
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
  await db.run(
    `INSERT INTO exam_attempts
     (id, exam_id, candidate_id, started_at, duration_minutes, question_order_json, option_maps_json, answers_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attemptId,
      examId,
      candidate.id,
      now,
      durationMinutes,
      JSON.stringify(questionOrder),
      JSON.stringify(optionMaps),
      JSON.stringify({})
    ]
  );

  return buildAttemptPayload(attemptId, exam, questionOrder, optionMaps, {}, now, durationMinutes);
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
    questionOrder
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

async function submitAttempt(attemptId, candidateId, candidateRow) {
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
    if (row.passed && !row.certificate_sent_at) {
      await deliverPassCertificate({
        attemptId: row.id,
        exam,
        candidateRow,
        scorePercent: row.score_percent
      });
    }
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
     SET submitted_at = ?, score_percent = ?, passed = ?, answers_json = ?
     WHERE id = ?`,
    [now, scorePercent, passed, JSON.stringify(answers), attemptId]
  );

  let certificateSent = false;
  let resultEmailSent = false;
  const alreadyPassed = await hasPassedAttempt(row.exam_id, candidateId, attemptId);
  if (passed) {
    const cert = await deliverPassCertificate({
      attemptId,
      exam,
      candidateRow,
      scorePercent
    });
    certificateSent = cert.certificateSent;
    resultEmailSent = cert.certificateSent;
  } else if (!passed && !alreadyPassed && candidateRow?.email) {
    try {
      await sendExamFailEmail({
        to: candidateRow.email,
        studentName: candidateRow.name,
        examTitle: exam.title,
        scorePercent,
        cutoffPercent: exam.cutoff_percent
      });
      await db.run("UPDATE exam_attempts SET result_email_sent_at = ? WHERE id = ?", [now, attemptId]);
      resultEmailSent = true;
    } catch (e) {
      console.error("Exam result email failed:", e.message);
    }
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
  if (row.passed && !row.certificate_sent_at && exam) {
    const candidate = await db.get("SELECT id, name, email FROM candidates WHERE id = ?", [candidateId]);
    if (candidate?.email) {
      await deliverPassCertificate({
        attemptId: row.id,
        exam,
        candidateRow: candidate,
        scorePercent: row.score_percent
      });
      row = await db.get(
        "SELECT * FROM exam_attempts WHERE id = ? AND candidate_id = ?",
        [attemptId, candidateId]
      );
    }
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
    attemptNumber,
    attemptsMax: MAX_ATTEMPTS_PER_EXAM,
    canRetake: attemptNumber < MAX_ATTEMPTS_PER_EXAM,
    submittedAt: row.submitted_at
  };
}

module.exports = {
  MAX_ATTEMPTS_PER_EXAM,
  getExamById,
  listQuestionsForExam,
  getCandidateExamStatus,
  listExhaustedCandidateExams,
  rescheduleCandidateExam,
  deliverPassCertificate,
  startAttempt,
  saveAnswer,
  submitAttempt,
  getAttemptResult,
  parseOptions
};
