const { generateCertificatePdf } = require("./certificate-pdf");
const { formatCourse } = require("./format");

async function generateExamCertificatePdf({
  studentName,
  examTitle,
  courseName
}) {
  const displayCourse = formatCourse(courseName) || String(examTitle || "").trim();
  const { buffer, filename } = await generateCertificatePdf({
    studentName,
    courseName: displayCourse
  });
  return { buffer, filename };
}

module.exports = { generateExamCertificatePdf };
