const { getDb } = require("../db");

const WIPE_CONFIRM_PHRASE = "WIPE ALL EXAM DATA";

async function countTable(table) {
  const row = await getDb().get(`SELECT COUNT(*) AS n FROM ${table}`);
  return row?.n || 0;
}

async function wipeExamPlatform() {
  const db = getDb();
  const before = {
    exams: await countTable("exams"),
    questions: await countTable("questions"),
    attempts: await countTable("exam_attempts"),
    reschedules: await countTable("exam_attempt_resets"),
    candidates: await countTable("candidates"),
    otp_codes: await countTable("otp_codes")
  };

  await db.run("DELETE FROM exam_attempt_resets");
  await db.run("DELETE FROM exam_attempts");
  await db.run("DELETE FROM questions");
  await db.run("DELETE FROM exams");
  await db.run("DELETE FROM otp_codes");
  await db.run("DELETE FROM candidates");
  await db.run(
    "UPDATE activation_codes SET candidate_id = NULL, used_at = NULL WHERE candidate_id IS NOT NULL OR used_at IS NOT NULL"
  );

  return {
    ok: true,
    message:
      "All exams, questions, attempts, and candidate registrations were removed. Partner accounts and activation codes were kept; used codes are available again.",
    removed: before
  };
}

module.exports = { WIPE_CONFIRM_PHRASE, wipeExamPlatform };
