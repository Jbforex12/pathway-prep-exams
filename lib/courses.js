const { normalizeCourseKey } = require("./course-match");

const COURSES = [
  "HEALTHCARE ASSISTANT",
  "PROFESSIONAL CLEANING & DOMESTIC SERVICE",
  "WAREHOUSING & LOGISTICS"
];

const catalogByKey = new Map(COURSES.map((name) => [normalizeCourseKey(name), name]));

function resolveCatalogCourse(name) {
  const key = normalizeCourseKey(name);
  if (!key) return null;
  return catalogByKey.get(key) || null;
}

function courseMatches(candidateCourse, examCourse) {
  const a = resolveCatalogCourse(candidateCourse);
  const b = resolveCatalogCourse(examCourse);
  return Boolean(a && b && a === b);
}

function validateCatalogCourseInput(name) {
  const resolved = resolveCatalogCourse(name);
  if (!resolved) {
    return {
      ok: false,
      error: `Course must be one of: ${COURSES.join(", ")}.`
    };
  }
  return { ok: true, course_name: resolved };
}

module.exports = {
  COURSES,
  resolveCatalogCourse,
  courseMatches,
  validateCatalogCourseInput
};
