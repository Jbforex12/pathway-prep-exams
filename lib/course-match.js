/** Normalize course names so "Health care assistant" matches "HEALTHCARE ASSISTANT". */
function normalizeCourseKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function courseMatches(candidateCourse, examCourse) {
  const a = normalizeCourseKey(candidateCourse);
  const b = normalizeCourseKey(examCourse);
  return Boolean(a && b && a === b);
}

module.exports = { normalizeCourseKey, courseMatches };
