const crypto = require("crypto");
const { getDb } = require("../db");
const { newId } = require("./security");
const { sendExamCertificateEmail } = require("./email");
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

  const existing = await db.get(
    `SELECT * FROM exam_attempts
     WHERE exam_id = ? AND candidate_id = ? AND submitted_at IS NOT NULL`,
    [examId, candidate.id]
  );
  if (existing) {
    const err = new Error("You have already completed this exam.");
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
  if (row.submitted_at) {
    return getAttemptResult(row.id, candidateId);
  }

  const exam = await getExamById(row.exam_id);
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
  const passed = scorePercent >= exam.cutoff_percent ? 1 : 0;
  const now = new Date().toISOString();

  await db.run(
    `UPDATE exam_attempts
     SET submitted_at = ?, score_percent = ?, passed = ?, answers_json = ?
     WHERE id = ?`,
    [now, scorePercent, passed, JSON.stringify(answers), attemptId]
  );

  let certificateSent = false;
  if (passed && candidateRow?.email) {
    try {
      const certId = newId("cert");
      const pdf = await generateExamCertificatePdf({
        studentName: candidateRow.name,
        examTitle: exam.title,
        courseName: exam.course_name,
        scorePercent,
        completedAt: now,
        certificateId: certId
      });
      await sendExamCertificateEmail({
        to: candidateRow.email,
        studentName: candidateRow.name,
        examTitle: exam.title,
        scorePercent,
        pdfBuffer: pdf
      });
      await db.run(
        "UPDATE exam_attempts SET certificate_sent_at = ?, certificate_id = ? WHERE id = ?",
        [now, certId, attemptId]
      );
      certificateSent = true;
    } catch (e) {
      console.error("Certificate email failed:", e.message);
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
    submittedAt: now
  };
}

async function getAttemptResult(attemptId, candidateId) {
  const db = getDb();
  const row = await db.get(
    "SELECT * FROM exam_attempts WHERE id = ? AND candidate_id = ?",
    [attemptId, candidateId]
  );
  if (!row || !row.submitted_at) {
    const err = new Error("Result not found.");
    err.status = 404;
    throw err;
  }
  const exam = await getExamById(row.exam_id);
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
    submittedAt: row.submitted_at
  };
}

module.exports = {
  courseMatches,
  getExamById,
  listQuestionsForExam,
  startAttempt,
  saveAnswer,
  submitAttempt,
  getAttemptResult,
  parseOptions
};
