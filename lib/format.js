/** @typedef {Record<string, string>} CourseLabelMap */

/** Normalise for course label lookup (lowercase, & -> and, collapse spaces). */
function normalizeCourseInput(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

const COURSE_LABELS = {
  "health care assistant": "Healthcare Assistant",
  "healthcare assistant": "Healthcare Assistant",
  "professional cleaning and domestic service": "Professional Cleaning & Domestic Services",
  "professional cleaning and domestic services": "Professional Cleaning & Domestic Services",
  "warehousing and logistics": "Warehousing & Logistics"
};

function titleCase(str) {
  return String(str || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatCourse(str) {
  const key = normalizeCourseInput(str);
  if (COURSE_LABELS[key]) return COURSE_LABELS[key];
  return titleCase(str);
}

module.exports = { titleCase, formatCourse, normalizeCourseInput, COURSE_LABELS };
