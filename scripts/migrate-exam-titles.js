/**
 * One-off migration: exam titles, track codes, and standard settings.
 * Run: node scripts/migrate-exam-titles.js
 * Requires TURSO_* or uses local data/pathway-exams.db
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { initDb, getDb } = require("../db");
const { normalizeCourseKey } = require("../lib/course-match");

const EXAM_CATALOG = [
  {
    code: "HCA",
    title: "Healthcare Assistant — Final Assessment",
    courseKeys: ["healthcareassistant"]
  },
  {
    code: "PCD",
    title: "Professional Cleaning & Domestic Services — Final Assessment",
    courseKeys: ["professionalcleaningdomesticservice", "professionalcleaningdomesticservices"]
  },
  {
    code: "WHL",
    title: "Warehousing & Logistics — Final Assessment",
    courseKeys: ["warehousinglogistics"]
  }
];

const SETTINGS = {
  duration_minutes: 60,
  cutoff_percent: 70,
  question_count: 10
};

function catalogForCourse(courseName) {
  const key = normalizeCourseKey(courseName);
  return EXAM_CATALOG.find((c) => c.courseKeys.includes(key)) || null;
}

async function main() {
  await initDb(path.join(__dirname, "..", "data"));
  const db = getDb();
  const now = new Date().toISOString();
  const exams = await db.all("SELECT * FROM exams ORDER BY created_at ASC");

  console.log(`Found ${exams.length} exam(s).`);

  for (const exam of exams) {
    const titleLower = String(exam.title || "").trim().toLowerCase();
    let catalog = catalogForCourse(exam.course_name);

    if (titleLower === "bath a exam") {
      catalog = EXAM_CATALOG[0];
      console.log(`Renaming legacy exam "${exam.title}" -> ${catalog.title} (${catalog.code})`);
    }

    if (!catalog) {
      console.log(`Skip (no catalog match): ${exam.id} "${exam.title}" course="${exam.course_name}"`);
      continue;
    }

    await db.run(
      `UPDATE exams SET
        title = ?,
        code = ?,
        duration_minutes = ?,
        cutoff_percent = ?,
        question_count = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        catalog.title,
        catalog.code,
        SETTINGS.duration_minutes,
        SETTINGS.cutoff_percent,
        SETTINGS.question_count,
        now,
        exam.id
      ]
    );
    console.log(`Updated ${exam.id}: ${catalog.code} — ${catalog.title}`);
  }

  console.log("Migration complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
