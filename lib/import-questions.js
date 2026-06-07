const { getDb } = require("../db");
const { newId } = require("./security");
const { normalizeQuestionInput } = require("./question-types");

async function importQuestionsForExam(examId, questions, { replace = true } = {}) {
  const db = getDb();
  if (replace) {
    await db.run("DELETE FROM questions WHERE exam_id = ?", [examId]);
  }

  const now = new Date().toISOString();
  let imported = 0;

  for (const raw of questions) {
    const q = normalizeQuestionInput(raw);
    if (!q) continue;
    await db.run(
      `INSERT INTO questions
       (id, exam_id, sort_order, prompt, question_type, options_json, correct_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId("q"),
        examId,
        parseInt(raw.sort_order, 10) || imported + 1,
        q.prompt,
        q.question_type,
        JSON.stringify(q.options),
        q.correct_index,
        now
      ]
    );
    imported += 1;
  }

  const count = await db.get("SELECT COUNT(*) AS n FROM questions WHERE exam_id = ?", [examId]);
  const pool = count?.n || 0;

  if (pool > 0) {
    await db.run(
      "UPDATE exams SET question_count = ?, updated_at = ? WHERE id = ?",
      [pool, now, examId]
    );
  }

  return { imported, pool };
}

module.exports = { importQuestionsForExam };
